/*
 * ShortcutToggle — Copyright (c) 2026 Ethan
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { showNotification } from "@api/Notifications";
import { definePluginSettings, useSettings } from "@api/Settings";
import { FavoriteButton } from "@components/settings/tabs/plugins/PluginModalButtons";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps, findComponentByCodeLazy } from "@webpack";
import { Checkbox, showToast, useEffect, useState } from "@webpack/common";
const PLUGIN_VERSION = "0.2.7";
const UPDATE_API_URL = "https://api.github.com/repos/Sheixo/ShortcutToggle/releases?per_page=100";
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000;
const UPDATE_RETRY_INTERVAL = 60 * 60 * 1000;
type ParsedReleaseVersion = {
    numbers: number[];
    prerelease: string[];
};
type UpdateRelease = {
    tag: string;
    version: string;
    prerelease: boolean;
    url: string;
};
type UpdateCheckView = {
    status: "idle" | "checking" | "current" | "available" | "error";
    latest: UpdateRelease | null;
    checkedAt: number | null;
    error: string;
};
let updateCheckView: UpdateCheckView = { status: "idle", latest: null, checkedAt: null, error: "" };
const updateCheckListeners = new Set<(view: UpdateCheckView) => void>();
let updateCheckTimer: ReturnType<typeof setTimeout> | null = null;
let updateScheduleToken = 0;
let updateRequest: {
    controller: AbortController;
    timer: ReturnType<typeof setTimeout> | null;
    automatic: boolean;
} | null = null;
let lastUpdateAttemptAt: number | null = null;
function parseReleaseVersion(version: string): ParsedReleaseVersion | null {
    const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
    if (!match)
        return null;
    const numbers = match.slice(1, 4).map(Number);
    const prerelease = match[4]?.split(".") ?? [];
    if (numbers.some(number => !Number.isSafeInteger(number))
        || prerelease.some(part => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0")))
        return null;
    return { numbers, prerelease };
}
function compareReleaseVersions(left: string, right: string): number | null {
    const a = parseReleaseVersion(left), b = parseReleaseVersion(right);
    if (!a || !b)
        return null;
    for (let index = 0; index < 3; index++) {
        if (a.numbers[index] !== b.numbers[index])
            return a.numbers[index] > b.numbers[index] ? 1 : -1;
    }
    if (!a.prerelease.length || !b.prerelease.length)
        return Number(!a.prerelease.length) - Number(!b.prerelease.length);
    for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index++) {
        const x = a.prerelease[index], y = b.prerelease[index];
        if (x === y)
            continue;
        if (x === undefined || y === undefined)
            return x === undefined ? -1 : 1;
        const xNumeric = /^\d+$/.test(x), yNumeric = /^\d+$/.test(y);
        if (xNumeric !== yNumeric)
            return xNumeric ? -1 : 1;
        if (xNumeric && x.length !== y.length)
            return x.length > y.length ? 1 : -1;
        return x > y ? 1 : -1;
    }
    return 0;
}
function releaseFromTag(tag: unknown, prerelease: unknown): UpdateRelease | null {
    if (typeof tag !== "string" || tag.length > 128 || !parseReleaseVersion(tag))
        return null;
    return { tag, version: tag.replace(/^v/, ""), prerelease: prerelease === true,
        url: `https://github.com/Sheixo/ShortcutToggle/releases/tag/${encodeURIComponent(tag)}` };
}
function latestPublishedRelease(data: unknown): UpdateRelease | null {
    if (!Array.isArray(data))
        return null;
    let latest: UpdateRelease | null = null;
    for (const release of data) {
        if (!release || release.draft !== false)
            continue;
        const candidate = releaseFromTag(release.tag_name, release.prerelease);
        if (candidate && (!latest || compareReleaseVersions(candidate.version, latest.version) === 1))
            latest = candidate;
    }
    return latest;
}
function getUpdateCheckView(): UpdateCheckView {
    return { ...updateCheckView, latest: updateCheckView.latest ? { ...updateCheckView.latest } : null };
}
function notifyUpdateCheck(view: UpdateCheckView) {
    updateCheckView = view;
    for (const listener of updateCheckListeners) {
        try {
            listener(getUpdateCheckView());
        }
        catch { }
    }
}
function cachedUpdateView(): UpdateCheckView {
    const saved = settings.store.latestUpdateRelease;
    const latest = releaseFromTag(saved?.tag, saved?.prerelease);
    const time = Number(settings.store.lastUpdateCheckAt);
    const checkedAt = latest && Number.isFinite(time) && time > 0 && time <= Date.now() ? time : null;
    return { status: !latest ? "idle" : compareReleaseVersions(latest.version, PLUGIN_VERSION) === 1 ? "available" : "current",
        latest, checkedAt, error: "" };
}
function openUpdateRelease(release: UpdateRelease) {
    // Rebuild the URL from a validated tag; do not open API-provided URLs.
    const safe = releaseFromTag(release.tag, release.prerelease);
    if (safe)
        VencordNative.native.openExternal(safe.url);
}
function notifyNewRelease(release: UpdateRelease) {
    const previouslyNotified = settings.store.lastNotifiedRelease;
    const notificationOrder = typeof previouslyNotified === "string" ? compareReleaseVersions(release.version, previouslyNotified) : null;
    if (compareReleaseVersions(release.version, PLUGIN_VERSION) !== 1 || (notificationOrder !== null && notificationOrder <= 0))
        return;
    settings.store.lastNotifiedRelease = release.tag;
    const failed = () => {
        if (settings.store.lastNotifiedRelease === release.tag)
            settings.store.lastNotifiedRelease = previouslyNotified;
    };
    try {
        void showNotification({ title: "Mise à jour de ShortcutToggle",
            body: `La version ${release.version}${release.prerelease ? " (préversion)" : ""} est disponible. Clique pour ouvrir son téléchargement sur GitHub.`,
            onClick: () => openUpdateRelease(release) }).catch(failed);
    }
    catch {
        failed();
    }
}
function cancelUpdateRequest() {
    const request = updateRequest;
    updateRequest = null;
    if (!request)
        return;
    if (request.timer !== null)
        clearTimeout(request.timer);
    request.controller.abort();
}
async function checkForUpdates(automatic = false) {
    if (!running || updateRequest || (automatic && !settings.store.updateNotificationsEnabled))
        return;
    const cached = cachedUpdateView();
    if (automatic && ((cached.checkedAt !== null && Date.now() - cached.checkedAt < UPDATE_INTERVAL)
        || (updateCheckView.status === "error" && lastUpdateAttemptAt !== null && Date.now() - lastUpdateAttemptAt < UPDATE_RETRY_INTERVAL)))
        return;
    const token = generation;
    const request = { controller: new AbortController(), timer: null as ReturnType<typeof setTimeout> | null, automatic };
    updateRequest = request;
    lastUpdateAttemptAt = Date.now();
    const active = () => running && generation === token && updateRequest === request
        && (!automatic || settings.store.updateNotificationsEnabled);
    notifyUpdateCheck({ ...getUpdateCheckView(), status: "checking", error: "" });
    try {
        const timeout = new Promise<never>((_resolve, reject) => {
            request.timer = setTimeout(() => {
                request.controller.abort();
                reject(new Error("La vérification a dépassé dix secondes. Réessaie plus tard."));
            }, 10000);
        });
        const operation = (async () => {
            const response = await fetch(UPDATE_API_URL, { headers: { Accept: "application/vnd.github+json" },
                credentials: "omit", referrerPolicy: "no-referrer", signal: request.controller.signal });
            if (!response.ok) {
                if (response.status === 403 || response.status === 429)
                    throw new Error("GitHub refuse la vérification pour le moment. Réessaie plus tard.");
                throw new Error("Impossible de consulter les versions sur GitHub. Réessaie plus tard.");
            }
            const latest = latestPublishedRelease(await response.json());
            if (!latest)
                throw new Error("Aucune version reconnue dans la réponse de GitHub.");
            return latest;
        })();
        const latest = await Promise.race([operation, timeout]);
        if (!active())
            return;
        const checkedAt = Date.now();
        settings.store.latestUpdateRelease = latest;
        settings.store.lastUpdateCheckAt = checkedAt;
        const available = compareReleaseVersions(latest.version, PLUGIN_VERSION) === 1;
        notifyUpdateCheck({ status: available ? "available" : "current", latest, checkedAt, error: "" });
        if (available)
            notifyNewRelease(latest);
    }
    catch (error) {
        if (active())
            notifyUpdateCheck({ ...getUpdateCheckView(), status: "error",
                error: error instanceof Error && error.message.startsWith("GitHub") ? error.message
                    : error instanceof Error && (error.message.startsWith("Aucune version") || error.message.startsWith("La vérification")) ? error.message
                        : "Vérification impossible. Vérifie ta connexion Internet, puis réessaie." });
    }
    finally {
        if (request.timer !== null)
            clearTimeout(request.timer);
        request.controller.abort();
        if (updateRequest === request)
            updateRequest = null;
    }
}
function scheduleUpdateCheck(delay: number) {
    if (updateCheckTimer !== null)
        clearTimeout(updateCheckTimer);
    const scheduleToken = ++updateScheduleToken, lifecycleToken = generation;
    updateCheckTimer = setTimeout(async () => {
        if (!running || lifecycleToken !== generation || scheduleToken !== updateScheduleToken || !settings.store.updateNotificationsEnabled)
            return;
        updateCheckTimer = null;
        await checkForUpdates(true);
        if (running && lifecycleToken === generation && scheduleToken === updateScheduleToken && settings.store.updateNotificationsEnabled)
            scheduleUpdateCheck(updateRequest || updateCheckView.status === "error" ? UPDATE_RETRY_INTERVAL : UPDATE_INTERVAL);
    }, delay);
}
function updateVersionCheckSchedule() {
    updateScheduleToken++;
    if (updateCheckTimer !== null)
        clearTimeout(updateCheckTimer);
    updateCheckTimer = null;
    if (!running)
        return;
    if (!settings.store.updateNotificationsEnabled) {
        if (updateRequest?.automatic) {
            cancelUpdateRequest();
            notifyUpdateCheck(cachedUpdateView());
        }
        return;
    }
    const cached = cachedUpdateView();
    if (cached.status === "available" && cached.latest)
        notifyNewRelease(cached.latest);
    const delay = cached.checkedAt === null ? 20000 : Math.max(20000, UPDATE_INTERVAL - (Date.now() - cached.checkedAt));
    scheduleUpdateCheck(delay);
}
function startUpdateChecks() {
    lastUpdateAttemptAt = null;
    notifyUpdateCheck(cachedUpdateView());
    updateVersionCheckSchedule();
}
function stopUpdateChecks() {
    updateScheduleToken++;
    if (updateCheckTimer !== null)
        clearTimeout(updateCheckTimer);
    updateCheckTimer = null;
    cancelUpdateRequest();
    notifyUpdateCheck({ status: "idle", latest: null, checkedAt: null, error: "" });
}
/* =========================================================
 * TYPES
 * ======================================================= */
type CapturedKeybind = {
    id: number;
    shortcut: any[];
    callback: (isDown: boolean) => unknown;
    guardedCallback: (isDown: boolean) => unknown;
    options: any;
    signature: string | null;
    custom: boolean;
    registered: boolean;
    held: boolean;
};
/* =========================================================
 * PARAMÈTRES VENCORD
 * ======================================================= */
const settings = definePluginSettings({
    toggleShortcut: {
        type: OptionType.STRING,
        description: "Raccourci pour activer/désactiver les raccourcis Discord. Exemples : CTRL+SHIFT+F10, F13, CTRL+ALT+K",
        default: "F13",
        hidden: true,
        onChange: scheduleSelectedKeybindRefresh
    },
    updateNotificationsEnabled: {
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
        description: "Vérifier automatiquement les nouvelles versions sur GitHub.",
        onChange: updateVersionCheckSchedule
    },
    lastUpdateCheckAt: { type: OptionType.CUSTOM, default: 0 },
    latestUpdateRelease: { type: OptionType.CUSTOM, default: null as UpdateRelease | null },
    lastNotifiedRelease: { type: OptionType.CUSTOM, default: "" },
    streamDeckEnabled: {
        type: OptionType.BOOLEAN,
        description: "Activer la connexion Stream Deck sur cet ordinateur.",
        default: false,
        hidden: true,
        onChange: updateStreamDeckConnection
    },
    streamDeckPreferenceInitialized: {
        type: OptionType.BOOLEAN,
        description: "Migration de la préférence Stream Deck.",
        default: false,
        hidden: true
    },
    lastValidToggleShortcut: {
        type: OptionType.CUSTOM,
        default: "F13"
    },
    selectedKeybindIds: {
        type: OptionType.CUSTOM,
        default: [] as string[],
        onChange: scheduleSelectedKeybindRefresh
    },
    selectionInitialized: {
        type: OptionType.BOOLEAN,
        description: "Indique si la sélection initiale des raccourcis Discord a déjà été créée.",
        default: false,
        hidden: true
    },
    pluginSettings: {
        type: OptionType.COMPONENT,
        component: ShortcutSettings
    }
});
/* =========================================================
 * CONFIGURATION
 * ======================================================= */
/*
 * ID natif réservé à notre raccourci.
 */
const TOGGLE_ID = 1396921420;
/*
 * Serveur WebSocket du plugin Stream Deck.
 */
const STREAM_DECK_URL = "ws://127.0.0.1:45873";
/* =========================================================
 * TOUCHES DISPONIBLES POUR LE RACCOURCI PERSONNALISÉ
 * ======================================================= */
const KEY_CODES: Record<string, number> = {
    CTRL: 162,
    CONTROL: 162,
    LCTRL: 162,
    RCTRL: 163,
    SHIFT: 160,
    LSHIFT: 160,
    RSHIFT: 161,
    ALT: 164,
    LALT: 164,
    RALT: 165,
    WIN: 91,
    WINDOWS: 91,
    META: 91,
    RWIN: 92,
    NUMPADMULTIPLY: 106,
    NUMPADADD: 107,
    NUMPADSUBTRACT: 109,
    NUMPADDECIMAL: 110,
    NUMPADDIVIDE: 111,
    SPACE: 32,
    TAB: 9,
    ESC: 27,
    ESCAPE: 27,
    ENTER: 13,
    BACKSPACE: 8,
    DELETE: 46,
    INSERT: 45,
    HOME: 36,
    END: 35,
    PAGEUP: 33,
    PAGEDOWN: 34,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    F1: 112,
    F2: 113,
    F3: 114,
    F4: 115,
    F5: 116,
    F6: 117,
    F7: 118,
    F8: 119,
    F9: 120,
    F10: 121,
    F11: 122,
    F12: 123,
    F13: 124,
    F14: 125,
    F15: 126,
    F16: 127,
    F17: 128,
    F18: 129,
    F19: 130,
    F20: 131,
    F21: 132,
    F22: 133,
    F23: 134,
    F24: 135
};
/*
 * A → Z
 */
for (let code = 65; code <= 90; code++) {
    KEY_CODES[String.fromCharCode(code)] = code;
}
/*
 * 0 → 9
 */
for (let code = 48; code <= 57; code++) {
    KEY_CODES[String.fromCharCode(code)] = code;
}
/*
 * Convertit :
 *
 * CTRL+SHIFT+F10
 *
 * en :
 *
 * [
 *   [0, 162],
 *   [0, 160],
 *   [0, 121]
 * ]
 */
function parseShortcut(shortcut: string): any[] | null {
    const parts = shortcut
        .toUpperCase()
        .replace(/\s+/g, "")
        .split("+")
        .filter(Boolean);
    if (!parts.length)
        return null;
    const result: any[] = [];
    for (const part of parts) {
        const code = KEY_CODES[part];
        if (code == null) {
            console.error(`[ShortcutToggle] Touche inconnue : ${part}`);
            return null;
        }
        /*
         * 0 = clavier
         */
        result.push([0, code]);
    }
    return result;
}
for (let digit = 0; digit <= 9; digit++)
    KEY_CODES[`NUMPAD${digit}`] = 96 + digit;
function getShortcutSetting() {
    return String(settings.store.toggleShortcut
        ?? "F13")
        .trim()
        .toUpperCase();
}
/* =========================================================
 * ENREGISTREMENT DU RACCOURCI GLOBAL
 * ======================================================= */
type ShortcutRecordingView = {
    recording: boolean;
    preview: string;
    error: string;
};
type ShortcutRecordingSession = {
    owner: symbol;
    pressed: Map<string, string>;
    candidate: string | null;
    invalid: boolean;
    cleanup: () => void;
};
let shortcutRecording: ShortcutRecordingSession | null = null;
let shortcutSuppressUntil = 0;
let shortcutRecordingView: ShortcutRecordingView = { recording: false, preview: "", error: "" };
const shortcutRecordingListeners = new Set<(view: ShortcutRecordingView) => void>();
const MODIFIER_TOKENS = ["CTRL", "RCTRL", "SHIFT", "RSHIFT", "ALT", "RALT", "WIN", "RWIN"];
function notifyShortcutRecording(view = shortcutRecordingView) {
    shortcutRecordingView = { ...view };
    for (const listener of shortcutRecordingListeners) {
        try {
            listener(shortcutRecordingView);
        }
        catch { }
    }
}
function recordingInputSuppressed(): boolean {
    return shortcutRecording !== null || Date.now() < shortcutSuppressUntil;
}
function keyboardEventToken(event: KeyboardEvent): string | null {
    const modifiers: Record<string, string> = {
        ControlLeft: "CTRL", ControlRight: "RCTRL", ShiftLeft: "SHIFT", ShiftRight: "RSHIFT",
        AltLeft: "ALT", AltRight: "RALT", MetaLeft: "WIN", MetaRight: "RWIN"
    };
    if (modifiers[event.code])
        return modifiers[event.code];
    if (event.key === "Control")
        return event.location === 2 ? "RCTRL" : "CTRL";
    if (event.key === "Shift")
        return event.location === 2 ? "RSHIFT" : "SHIFT";
    if (event.key === "Alt")
        return event.location === 2 ? "RALT" : "ALT";
    if (event.key === "Meta")
        return event.location === 2 ? "RWIN" : "WIN";
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.key))
        return event.key;
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.code))
        return event.code;
    // Windows virtual-key values follow the active layout, including AZERTY.
    // Prefer the letter produced by the key, rather than its QWERTY physical position.
    if (/^[a-z]$/i.test(event.key))
        return event.key.toUpperCase();
    if (/^Key[A-Z]$/.test(event.code) && event.keyCode >= 65 && event.keyCode <= 90) {
        return String.fromCharCode(event.keyCode);
    }
    if (/^Digit[0-9]$/.test(event.code))
        return event.code.slice(-1);
    const names: Record<string, string> = {
        Space: "SPACE", Tab: "TAB", Enter: "ENTER", NumpadEnter: "ENTER",
        Backspace: "BACKSPACE", Delete: "DELETE", Insert: "INSERT", Home: "HOME", End: "END",
        PageUp: "PAGEUP", PageDown: "PAGEDOWN", ArrowLeft: "LEFT", ArrowUp: "UP",
        ArrowRight: "RIGHT", ArrowDown: "DOWN", NumpadAdd: "NUMPADADD",
        NumpadSubtract: "NUMPADSUBTRACT", NumpadMultiply: "NUMPADMULTIPLY",
        NumpadDivide: "NUMPADDIVIDE", NumpadDecimal: "NUMPADDECIMAL"
    };
    if (names[event.key])
        return names[event.key];
    if (/^Numpad[0-9]$/.test(event.code))
        return /^[0-9]$/.test(event.key) ? `NUMPAD${event.code.slice(-1)}` : null;
    return names[event.code] ?? null;
}
function keyboardEventIdentity(event: KeyboardEvent): string {
    return event.code || `${event.key}:${event.location}`;
}
function finishShortcutRecording() {
    const session = shortcutRecording;
    if (!session)
        return;
    shortcutRecording = null;
    session.cleanup();
    // Discard the final native event of the chord used to record or cancel.
    shortcutSuppressUntil = Date.now() + 250;
}
function cancelShortcutRecording(owner?: symbol) {
    if (owner && shortcutRecording?.owner !== owner)
        return;
    finishShortcutRecording();
    notifyShortcutRecording({ recording: false, preview: "", error: "" });
}
function applyRecordedShortcut(text: string): boolean {
    if (!running || !initialized || !NativeInput || !parseShortcut(text))
        return false;
    const previousText = settings.store.toggleShortcut;
    settings.store.toggleShortcut = text;
    if (registerToggleShortcut() && registeredShortcut === text)
        return true;
    // Native registration may fail; retain the previous setting and working hotkey.
    settings.store.toggleShortcut = previousText;
    observedShortcutSetting = getShortcutSetting();
    return false;
}
function resetToggleShortcut() {
    finishShortcutRecording();
    const ok = applyRecordedShortcut("F13");
    notifyShortcutRecording({
        recording: false, preview: "",
        error: ok ? "" : "Impossible d'appliquer F13. Le raccourci précédent est conservé."
    });
}
function startShortcutRecording(owner: symbol) {
    if (!running || !initialized || !NativeInput) {
        notifyShortcutRecording({ recording: false, preview: "", error: "Le plugin n'est pas encore prêt." });
        return;
    }
    finishShortcutRecording();
    const token = generation;
    const session: ShortcutRecordingSession = {
        owner, pressed: new Map(), candidate: null, invalid: false, cleanup: () => { }
    };
    const active = () => shortcutRecording === session && running && generation === token;
    const swallow = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const hasModifiers = (event: KeyboardEvent) => event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
    const syncModifiers = (event: KeyboardEvent) => {
        for (const [code, name] of session.pressed) {
            if ((["CTRL", "RCTRL"].includes(name) && !event.ctrlKey)
                || (["SHIFT", "RSHIFT"].includes(name) && !event.shiftKey)
                || (["ALT", "RALT"].includes(name) && !event.altKey)
                || (["WIN", "RWIN"].includes(name) && !event.metaKey))
                session.pressed.delete(code);
        }
    };
    const onKeyDown = (event: KeyboardEvent) => {
        if (!active())
            return;
        swallow(event);
        if (event.key === "Escape" || event.code === "Escape") {
            cancelShortcutRecording(owner);
            return;
        }
        if (event.repeat)
            return;
        if (!session.pressed.size) {
            session.invalid = false;
            session.candidate = null;
        }
        const name = event.isComposing ? null : keyboardEventToken(event);
        session.pressed.set(keyboardEventIdentity(event), name ?? "?");
        syncModifiers(event);
        const keys = [...session.pressed.values()].filter(value => !MODIFIER_TOKENS.includes(value));
        if (!name || keys.length > 1) {
            session.invalid = true;
            session.candidate = null;
            notifyShortcutRecording({ recording: true, preview: "", error: !name
                    ? "Touche non prise en charge. Essaie une lettre, F1 à F24 ou une touche de navigation."
                    : "Utilise une seule touche, éventuellement avec Ctrl, Maj, Alt ou Windows." });
            return;
        }
        if (session.invalid)
            return;
        const names = new Set(session.pressed.values());
        // Modifiers can already be held when the user clicks the recording button.
        for (const [held, left, right] of [
            [event.ctrlKey, "CTRL", "RCTRL"], [event.shiftKey, "SHIFT", "RSHIFT"],
            [event.altKey, "ALT", "RALT"], [event.metaKey, "WIN", "RWIN"]
        ] as const) {
            if (held && !names.has(left) && !names.has(right))
                names.add(left);
        }
        const parts = [...MODIFIER_TOKENS.filter(modifier => names.has(modifier)), ...keys];
        session.candidate = keys.length === 1 ? parts.join("+") : null;
        notifyShortcutRecording({ recording: true, preview: parts.join(" + "), error: "" });
    };
    const onKeyUp = (event: KeyboardEvent) => {
        if (!active())
            return;
        swallow(event);
        session.pressed.delete(keyboardEventIdentity(event));
        syncModifiers(event);
        if (session.pressed.size || hasModifiers(event))
            return;
        const text = session.invalid ? null : session.candidate;
        if (!text) {
            if (!session.invalid)
                notifyShortcutRecording({ recording: true, preview: "", error: "Ajoute une touche aux touches Ctrl, Maj, Alt ou Windows." });
            return;
        }
        finishShortcutRecording();
        const ok = applyRecordedShortcut(text);
        notifyShortcutRecording({ recording: false, preview: "", error: ok
                ? "" : "Impossible d'enregistrer ce raccourci. Le précédent est conservé." });
    };
    const onBlur = () => { if (active())
        cancelShortcutRecording(owner); };
    const onVisibilityChange = () => { if (document.hidden)
        onBlur(); };
    session.cleanup = () => {
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("keyup", onKeyUp, true);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("blur", onBlur);
    };
    shortcutRecording = session;
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    releaseBlockedKeybinds();
    notifyShortcutRecording({ recording: true, preview: "", error: "" });
}
// Compare complete native chords independently of tuple order. Keep device type,
// left/right modifiers and numpad keys distinct; ignore malformed chords.
function nativeShortcutSignature(shortcut: unknown): string | null {
    if (!Array.isArray(shortcut) || !shortcut.length)
        return null;
    const keys = new Set<string>();
    for (const key of shortcut) {
        if (!Array.isArray(key) || key.length !== 2
            || key.some(value => typeof value !== "number" && (typeof value !== "string" || !value.trim())))
            return null;
        const [type, code] = key.map(Number);
        if (!Number.isInteger(type) || type < 0 || !Number.isInteger(code) || code <= 0)
            return null;
        keys.add(`${type}:${code}`);
    }
    return [...keys].sort().join("|");
}
function getDiscordShortcutBindings(): any[] {
    return Object.values(getDiscordState()).filter(keybind => keybind
        && Number.isFinite(Number(keybind.id)) && Number(keybind.id) !== TOGGLE_ID
        && typeof keybind.action === "string" && keybind.action !== "UNASSIGNED"
        && nativeShortcutSignature(keybind.shortcut) !== null);
}
function getShortcutConflicts(text: string): any[] {
    const signature = nativeShortcutSignature(parseShortcut(text));
    if (!signature)
        return [];
    return getDiscordShortcutBindings().filter(keybind => nativeShortcutSignature(keybind.shortcut) === signature)
        .sort((a, b) => Number(Boolean(b.enabled)) - Number(Boolean(a.enabled))
        || formatAction(a.action).localeCompare(formatAction(b.action), "fr")
        || String(a.id).localeCompare(String(b.id)));
}
let observedConflictSnapshot = "";
const UI = {
    card: { padding: 18, borderRadius: 12, border: "1px solid var(--background-modifier-accent)", background: "var(--background-secondary)", minWidth: 0 },
    row: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
    title: { margin: 0, fontSize: 16, fontWeight: 600, color: "var(--header-primary)" },
    muted: { margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" },
    button: { padding: "9px 13px", border: "1px solid var(--background-modifier-accent)", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--text-normal)", background: "var(--background-tertiary)" },
    primary: { padding: "9px 14px", border: 0, borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "white", background: "var(--brand-500, #5865f2)" },
    badge: { display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
    key: { display: "inline-block", minWidth: 20, padding: "5px 8px", borderRadius: 5, border: "1px solid var(--background-modifier-accent)", borderBottomWidth: 2, background: "var(--background-tertiary)", color: "var(--text-normal)", fontSize: 12, fontFamily: "inherit", textAlign: "center" },
    input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 7, border: "1px solid var(--background-modifier-accent)", background: "var(--background-tertiary)", color: "var(--text-normal)", fontSize: 14 }
} as const;
function useKeybindList() {
    const [, rerender] = useState(0);
    useEffect(() => {
        const refresh = () => rerender(value => value + 1);
        keybindListListeners.add(refresh);
        return () => { keybindListListeners.delete(refresh); };
    }, []);
}
function Keycaps({ text }: {
    text: string;
}) {
    return <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
        {text.split(/\s*\+\s*/).map((part, index) => <span key={`${index}:${part}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {index > 0 && <span aria-hidden="true" style={{ color: "var(--text-muted)", fontSize: 12 }}>+</span>}
            <kbd style={UI.key}>{part}</kbd>
        </span>)}
    </span>;
}
function ShortcutStatus() {
    const pluginPreferences = useSettings(["plugins.ShortcutToggle.isFavorite"]).plugins.ShortcutToggle;
    settings.use(["selectedKeybindIds"]);
    useKeybindList();
    const [status, setStatus] = useState({ disabled, ready: initialized && running });
    useEffect(() => {
        const update = (next: boolean) => setStatus({ disabled: next, ready: initialized && running });
        stateListeners.add(update);
        update(disabled);
        return () => { stateListeners.delete(update); };
    }, []);
    const count = getTargetKeybinds().length;
    const label = !status.ready ? "Initialisation" : status.disabled ? "OFF" : "ON";
    const color = !status.ready ? "var(--text-muted)" : status.disabled ? "var(--status-danger, #ed4245)" : "var(--status-positive, #23a55a)";
    return <section style={UI.card} aria-label="État de ShortcutToggle">
        <div style={UI.row}>
            <div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <h3 style={UI.title}>ShortcutToggle</h3>
                    <span style={{ ...UI.badge, color, background: "var(--background-tertiary)" }} role="status" aria-live="polite">
                        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: color }}/>{label}
                    </span>
                    <FavoriteButton isFavorite={pluginPreferences.isFavorite ?? false} onClick={() => { pluginPreferences.isFavorite = !pluginPreferences.isFavorite; }}/>
                </div>
                <p style={UI.muted}>{!status.ready ? "Préparation des raccourcis Discord…"
            : status.disabled ? "Les raccourcis cochés sont suspendus." : "Les raccourcis cochés peuvent fonctionner."}</p>
            </div>
            <button type="button" style={{ ...UI.primary, opacity: status.ready ? 1 : 0.5 }} disabled={!status.ready} onClick={toggleKeybinds}>{status.disabled ? "Réactiver les raccourcis" : "Désactiver les raccourcis"}</button>
        </div>
        <p style={{ ...UI.muted, marginTop: 12 }}>{count} raccourci{count > 1 ? "s" : ""} actif{count > 1 ? "s" : ""} dans Discord actuellement contrôlé{count > 1 ? "s" : ""}.</p>
    </section>;
}
function ShortcutRecorder() {
    const { toggleShortcut } = settings.use(["toggleShortcut"]);
    useKeybindList();
    const [owner] = useState(() => Symbol("ShortcutRecorder"));
    const [view, setView] = useState(shortcutRecordingView);
    useEffect(() => {
        shortcutRecordingListeners.add(setView);
        setView(shortcutRecordingView);
        return () => {
            shortcutRecordingListeners.delete(setView);
            cancelShortcutRecording(owner);
        };
    }, [owner]);
    const current = registeredShortcut || String(toggleShortcut ?? "F13");
    const checkedShortcut = view.recording ? (view.error ? "" : view.preview) : current;
    const conflicts = getShortcutConflicts(checkedShortcut);
    return <section style={UI.card} aria-label="Raccourci global">
        <div style={UI.row}>
            <div><h3 style={UI.title}>Raccourci global</h3><p style={UI.muted}>Bascule ON/OFF depuis le clavier, même hors de Discord.</p></div>
            <Keycaps text={current}/>
        </div>
        <div style={{ ...UI.row, justifyContent: "flex-start", marginTop: 14, gap: 8 }}>
            <button type="button" style={view.recording ? UI.button : UI.primary} onClick={() => view.recording ? cancelShortcutRecording(owner) : startShortcutRecording(owner)}>
                {view.recording ? "Annuler l’enregistrement" : "Enregistrer un raccourci"}
            </button>
            <button type="button" style={UI.button} onClick={resetToggleShortcut}>Réinitialiser à F13</button>
        </div>
        <div role="status" aria-live="polite" style={{ marginTop: 10 }}>
            {view.recording && view.preview && <div style={{ marginBottom: 8 }}><Keycaps text={view.preview}/></div>}
            <p style={{ ...UI.muted, color: view.error ? "var(--text-danger)" : "var(--text-muted)" }}>{view.error || (view.recording
            ? (view.preview ? "Relâche toutes les touches pour enregistrer. Échap pour annuler." : "Appuie sur une touche ou une combinaison. Échap pour annuler.")
            : "Le raccourci est appliqué dès que tu relâches les touches.")}</p>
        </div>
        <div role="status" aria-live="polite" aria-atomic="true" aria-label="Conflits du raccourci">
            {conflicts.length > 0 && <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8,
                border: "1px solid var(--status-warning, #f0b232)", background: "var(--background-primary)" }}>
                <p style={{ ...UI.muted, marginTop: 0, color: "var(--text-normal)", fontWeight: 600 }}>
                    ⚠ {conflicts.some(keybind => keybind.enabled) ? "Combinaison déjà utilisée dans Discord" : "Conflit possible si un raccourci Discord est réactivé"}
                </p>
                <ul style={{ margin: "8px 0", paddingLeft: 20, color: "var(--text-normal)", fontSize: 13, lineHeight: 1.6 }}>
                    {conflicts.map(keybind => <li key={String(keybind.id)}>{formatAction(keybind.action)}
                        {!keybind.enabled && <span style={{ color: "var(--text-muted)" }}> — désactivé dans Discord</span>}
                    </li>)}
                </ul>
                <p style={UI.muted}>Cette combinaison peut aussi déclencher ces actions lorsque leurs raccourcis sont actifs.
                    Choisis une autre combinaison pour éviter le conflit. Tu peux conserver ce raccourci si cette utilisation est volontaire.</p>
            </div>}
        </div>
    </section>;
}
function filterKeybinds(keybinds: any[], query: string): any[] {
    const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
    return keybinds.filter(keybind => {
        const text = normalize(`${formatShortcut(keybind.shortcut)} ${formatAction(keybind.action)} ${keybind.action}`);
        return tokens.every(token => text.includes(token));
    });
}
function setKeybindSelection(ids: string[], checked: boolean) {
    const selection = getSelectedIds();
    for (const id of ids) {
        if (checked)
            selection.add(id);
        else
            selection.delete(id);
    }
    settings.store.selectedKeybindIds = [...selection];
    scheduleSelectedKeybindRefresh();
}
function KeybindSelector() {
    const { selectedKeybindIds } = settings.use(["selectedKeybindIds"]);
    useKeybindList();
    const [query, setQuery] = useState("");
    const selected = new Set<string>(selectedKeybindIds ?? []);
    const keybinds = getCustomDiscordKeybinds().sort((a, b) => formatAction(a.action).localeCompare(formatAction(b.action), "fr")
        || formatShortcut(a.shortcut).localeCompare(formatShortcut(b.shortcut), "fr", { numeric: true }));
    const visible = filterKeybinds(keybinds, query);
    const ids = visible.map(keybind => String(keybind.id));
    const selectedCount = keybinds.filter(keybind => selected.has(String(keybind.id))).length;
    const filtered = query.trim().length > 0;
    return <section style={UI.card} aria-label="Raccourcis contrôlés">
        <div style={UI.row}>
            <h3 style={UI.title}>Raccourcis contrôlés</h3>
            <span style={{ ...UI.badge, color: "var(--text-muted)", background: "var(--background-tertiary)" }}>{selectedCount} / {keybinds.length} sélectionnés</span>
        </div>
        <p style={UI.muted}>Coche les raccourcis à suspendre sur OFF. Les autres restent disponibles.</p>
        <label style={{ display: "block", marginTop: 14 }}>
            <span style={{ ...UI.muted, display: "block", marginBottom: 6 }}>Rechercher une touche ou une action</span>
            <input type="search" value={query} style={UI.input} placeholder="G, F13, micro, appuyer pour parler…" onChange={event => setQuery(event.currentTarget.value)}/>
        </label>
        <div style={{ ...UI.row, justifyContent: "flex-start", margin: "10px 0 14px", gap: 8 }}>
            <button type="button" style={UI.button} disabled={!ids.length} onClick={() => setKeybindSelection(ids, true)}>
                {filtered ? "Sélectionner les résultats" : "Tout sélectionner"}</button>
            <button type="button" style={UI.button} disabled={!ids.length} onClick={() => setKeybindSelection(ids, false)}>
                {filtered ? "Désélectionner les résultats" : "Tout désélectionner"}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
            {visible.map(keybind => {
            const id = String(keybind.id);
            const checked = selected.has(id);
            return <div key={id} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${checked ? "var(--brand-500, #5865f2)" : "var(--background-modifier-accent)"}`, background: "var(--background-primary)" }}>
                    <Checkbox value={checked} onChange={() => setKeybindSelection([id], !checked)}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                            <span style={{ color: "var(--text-normal)", fontSize: 14, fontWeight: 500 }}>{formatAction(keybind.action)}</span>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                                <Keycaps text={formatShortcut(keybind.shortcut)}/>
                                {!keybind.enabled && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Désactivé dans Discord</span>}
                            </div>
                        </div>
                    </Checkbox>
                </div>;
        })}
        </div>
        {!keybinds.length && <p style={UI.muted}>Ajoute d’abord un raccourci dans Discord → Paramètres → Raccourcis clavier.</p>}
        {keybinds.length > 0 && !visible.length && <p style={UI.muted}>Aucun résultat. Essaie une autre touche ou une autre action.</p>}
        <p style={{ ...UI.muted, marginTop: 12 }}>Les changements s’appliquent immédiatement. Les nouveaux raccourcis sont cochés automatiquement. Un raccourci désactivé dans Discord reste désactivé.</p>
    </section>;
}
function StreamDeckSettings() {
    const { streamDeckEnabled } = settings.use(["streamDeckEnabled"]);
    const [connection, setConnection] = useState({ status: streamDeckStatus, diagnostics: getStreamDeckDiagnostics() });
    useEffect(() => {
        const update = (status: StreamDeckStatus, diagnostics = getStreamDeckDiagnostics()) => setConnection({ status, diagnostics });
        streamDeckListeners.add(update);
        update(streamDeckStatus);
        return () => { streamDeckListeners.delete(update); };
    }, []);
    const { status, diagnostics } = connection;
    const diagnosticLabels: Record<StreamDeckCheckResult, string> = {
        idle: "Vérifie que le compagnon répond depuis cet ordinateur.",
        checking: "Vérification en cours…",
        ok: "Le compagnon Stream Deck répond correctement.",
        unavailable: "La connexion locale n’a pas pu être établie.",
        noResponse: "La connexion s’est ouverte, mais aucune réponse compatible n’a été reçue.",
        interrupted: "La connexion a été interrompue pendant la vérification.",
        sendFailed: "Le compagnon répond, mais l’envoi de l’état a échoué."
    };
    const needsHelp = status === "disconnected" || ["unavailable", "noResponse", "interrupted", "sendFailed"].includes(diagnostics.result);
    const contactTime = diagnostics.lastMessageAt ?? diagnostics.lastConnectedAt;
    const labels: Record<StreamDeckStatus, string> = { disabled: "Désactivé", connecting: "Connexion…", connected: "Connecté", disconnected: "Déconnecté" };
    return <section style={UI.card} aria-label="Connexion Stream Deck">
        <div style={UI.row}>
            <h3 style={UI.title}>Stream Deck <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 400 }}>Facultatif</span></h3>
            <span style={{ ...UI.badge, background: "var(--background-tertiary)", color: status === "connected" ? "var(--status-positive, #23a55a)" : "var(--text-muted)" }} role="status" aria-live="polite">{labels[status]}</span>
        </div>
        <div style={{ marginTop: 14 }}><Checkbox value={streamDeckEnabled} onChange={() => { settings.store.streamDeckEnabled = !streamDeckEnabled; }}>
            Activer la connexion Stream Deck
        </Checkbox></div>
        <p style={UI.muted}>{streamDeckEnabled ? "Le bouton Stream Deck suit le même état ON/OFF que Discord. La reconnexion est automatique." : "Le bouton Discord et le raccourci clavier fonctionnent indépendamment de Stream Deck."}</p>
        {streamDeckEnabled && <>
            <div style={{ ...UI.row, justifyContent: "flex-start", marginTop: 12, gap: 8 }}>
                <button type="button" style={UI.button} onClick={checkStreamDeckConnection} disabled={diagnostics.result === "checking" || !running}>
                    {diagnostics.result === "checking" ? "Vérification…" : "Vérifier la connexion"}</button>
                <button type="button" style={UI.button} onClick={reconnectStreamDeck}>Reconnecter</button>
            </div>
            <div aria-label="Diagnostic Stream Deck" role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: 12 }}>
                <p style={{ ...UI.muted, color: diagnostics.result === "ok" ? "var(--status-positive, #23a55a)" : needsHelp ? "var(--text-danger)" : "var(--text-muted)" }}>
                    {diagnosticLabels[diagnostics.result]}</p>
                {diagnostics.checkedAt !== null && <p style={UI.muted}>Dernière vérification : {new Date(diagnostics.checkedAt).toLocaleTimeString("fr-FR")}.</p>}
                {contactTime !== null && <p style={UI.muted}>{diagnostics.lastMessageAt !== null ? "Dernier échange" : "Dernière connexion"} : {new Date(contactTime).toLocaleTimeString("fr-FR")}.</p>}
                {diagnostics.attempts > 1 && <p style={UI.muted}>{diagnostics.attempts} tentatives de connexion depuis l’activation.</p>}
                {diagnostics.result === "ok" && status !== "connected" && <p style={UI.muted}>Le compagnon est disponible. Clique sur « Reconnecter » pour rétablir la liaison avec Discord.</p>}
            </div>
            {needsHelp && <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8,
                    border: "1px solid var(--background-modifier-accent)", background: "var(--background-primary)" }}>
                <p style={{ ...UI.muted, marginTop: 0, color: "var(--text-normal)", fontWeight: 600 }}>À vérifier</p>
                <ol style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--text-normal)", fontSize: 13, lineHeight: 1.6 }}>
                    <li>Ouvre l’application Stream Deck sur le même ordinateur que Discord.</li>
                    <li>Vérifie que « Discord Shortcuts » est installé et ajoute son action « Raccourcis Clavier Discord » à une touche.</li>
                    <li>Ferme complètement puis relance Stream Deck, et clique sur « Vérifier la connexion ».</li>
                </ol>
                <details style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>
                    <summary style={{ cursor: "pointer" }}>Si le problème continue</summary>
                    <p style={UI.muted}>{diagnostics.result === "noResponse"
                    ? "Un service local répond sans le message attendu. Vérifie la version du compagnon et qu’une ancienne copie n’utilise pas déjà le même port."
                    : "La connexion utilise uniquement cet ordinateur. Vérifie qu’une ancienne copie du compagnon n’utilise pas déjà le port local 45873. Les journaux de Stream Deck peuvent préciser la cause."}</p>
                </details>
            </div>}
        </>}
        <details style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
            <summary style={{ cursor: "pointer" }}>Configurer Stream Deck</summary>
            <p style={UI.muted}>Installe « Discord Shortcuts » dans l’application Stream Deck, ajoute son action à une touche, puis active la connexion ici. Le lien utilise uniquement ton ordinateur, sur le port 45873.</p>
        </details>
    </section>;
}
function UpdateSettings() {
    const { updateNotificationsEnabled } = settings.use(["updateNotificationsEnabled"]);
    const [view, setView] = useState(getUpdateCheckView);
    useEffect(() => {
        updateCheckListeners.add(setView);
        setView(getUpdateCheckView());
        return () => { updateCheckListeners.delete(setView); };
    }, []);
    const available = view.latest !== null && compareReleaseVersions(view.latest.version, PLUGIN_VERSION) === 1;
    return <section style={UI.card} aria-label="Mises à jour de ShortcutToggle">
        <div style={UI.row}>
            <h3 style={UI.title}>Mises à jour</h3>
            <span style={{ ...UI.badge, color: "var(--text-muted)", background: "var(--background-tertiary)" }}>Version installée : {PLUGIN_VERSION}</span>
        </div>
        <div style={{ marginTop: 14 }}><Checkbox value={updateNotificationsEnabled} onChange={() => { settings.store.updateNotificationsEnabled = !updateNotificationsEnabled; }}>
            Vérifier automatiquement les nouvelles versions
        </Checkbox></div>
        <p style={UI.muted}>Consulte les publications publiques de Sheixo/ShortcutToggle sur GitHub, préversions incluses.
            La vérification automatique est quotidienne ; chaque nouvelle version est annoncée une seule fois.</p>
        <button type="button" style={{ ...UI.button, marginTop: 12 }} disabled={!running || view.status === "checking"} onClick={() => { void checkForUpdates(); }}>
            {view.status === "checking" ? "Vérification…" : "Vérifier les mises à jour"}</button>
        <div role="status" aria-live="polite" aria-atomic="true" style={{ marginTop: 10 }}>
            {view.status === "checking" && <p style={UI.muted}>Recherche des nouvelles versions…</p>}
            {view.status === "current" && <p style={UI.muted}>Aucune version plus récente disponible.</p>}
            {view.status === "idle" && <p style={UI.muted}>Lance une vérification pour consulter les versions disponibles.</p>}
            {view.status === "error" && <p style={{ ...UI.muted, color: "var(--text-danger)" }}>{view.error}</p>}
            {view.checkedAt !== null && <p style={UI.muted}>Dernière vérification réussie : {new Date(view.checkedAt).toLocaleString("fr-FR")}.</p>}
            {available && view.latest && <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8,
                border: "1px solid var(--brand-500, #5865f2)", background: "var(--background-primary)" }}>
                <p style={{ ...UI.muted, marginTop: 0, color: "var(--text-normal)", fontWeight: 600 }}>Nouvelle version disponible : {view.latest.version}{view.latest.prerelease ? " (préversion)" : ""}</p>
                <button type="button" style={{ ...UI.primary, marginTop: 10 }} onClick={() => openUpdateRelease(view.latest!)}>Ouvrir le téléchargement sur GitHub</button>
                <p style={UI.muted}>Télécharge le nouveau index.tsx, remplace ton fichier, reconstruis Vencord puis redémarre Discord.</p>
            </div>}
        </div>
    </section>;
}
function ShortcutSettings() {
    return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ShortcutStatus />
        <ShortcutRecorder />
        <KeybindSelector />
        <StreamDeckSettings />
        <UpdateSettings />
        <p style={{ ...UI.muted, marginTop: 0, textAlign: "center" }}>ShortcutToggle {PLUGIN_VERSION} · Discord bureau · Windows</p>
    </div>;
}
/* =========================================================
 * SÉLECTEUR DES RACCOURCIS DISCORD
 * ======================================================= */
/*
 * Transforme les codes natifs Discord/Windows en noms lisibles
 * dans les paramètres du plugin.
 */
function keyCodeName(type: number, code: number) {
    /*
     * Les raccourcis souris personnalisés de Discord
     * sont enregistrés avec le type 1.
     */
    if (type === 1) {
        return `MOUSE${code}`;
    }
    const names: Record<number, string> = {
        8: "BACKSPACE",
        9: "TAB",
        13: "ENTER",
        27: "ESC",
        32: "SPACE",
        33: "PAGE UP",
        34: "PAGE DOWN",
        35: "END",
        36: "HOME",
        37: "LEFT",
        38: "UP",
        39: "RIGHT",
        40: "DOWN",
        45: "INSERT",
        46: "DELETE",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        124: "F13",
        125: "F14",
        126: "F15",
        127: "F16",
        128: "F17",
        129: "F18",
        130: "F19",
        131: "F20",
        132: "F21",
        133: "F22",
        134: "F23",
        135: "F24",
        160: "SHIFT",
        161: "RSHIFT",
        162: "CTRL",
        163: "RCTRL",
        164: "ALT",
        165: "RALT"
    };
    if (names[code]) {
        return names[code];
    }
    /*
     * Lettres A-Z et chiffres 0-9.
     */
    if ((code >= 48 && code <= 57)
        ||
            (code >= 65 && code <= 90)) {
        return String.fromCharCode(code);
    }
    return `KEY ${code}`;
}
/*
 * Rend un raccourci Discord lisible.
 *
 * Exemple :
 * [[0, 162], [0, 71]]
 * ->
 * CTRL + G
 */
function formatShortcut(shortcut: any[]) {
    if (!Array.isArray(shortcut)) {
        return "?";
    }
    return shortcut
        .map(key => {
        if (!Array.isArray(key)) {
            return "?";
        }
        return keyCodeName(Number(key[0]), Number(key[1]));
    })
        .join(" + ");
}
/*
 * Noms français pour les actions Discord les plus courantes.
 * Si une action n'est pas connue, son nom Discord reste affiché.
 */
function formatAction(action: string) {
    const names: Record<string, string> = {
        PUSH_TO_MUTE: "Appuyer-pour-rendre-muet",
        PUSH_TO_TALK: "Appuyer-pour-parler",
        TOGGLE_MUTE: "Activer/désactiver le micro",
        TOGGLE_DEAFEN: "Activer/désactiver le son",
        DISCONNECT: "Déconnexion du vocal"
    };
    return names[action]
        ?? action
            .replaceAll("_", " ")
            .toLowerCase();
}
/*
 * Retourne tous les raccourcis créés par l'utilisateur
 * dans Discord -> Paramètres -> Raccourcis clavier.
 */
function getCustomDiscordKeybinds(): any[] {
    if (!KeybindStore)
        resolveModules();
    return Object.values(getDiscordState()).filter(keybind => isCustomKeybind(keybind)
        && typeof keybind.action === "string" && keybind.action !== "UNASSIGNED"
        && Array.isArray(keybind.shortcut) && keybind.shortcut.length > 0);
}
/* =========================================================
 * MODULES DISCORD
 * ======================================================= */
let KeybindStore: any = null;
let KeybindActions: any = null;
let NativeInput: any = null;
/*
 * Bouton utilisé dans le panneau
 * micro / casque / paramètres Discord.
 */
const PanelButton = findComponentByCodeLazy(".GREEN,positionKeyStemOverride:");
/* =========================================================
 * ÉTAT GLOBAL
 * ======================================================= */
// Registrations observed continuously, including keys selected later.
const captured = new Map<number, CapturedKeybind>();
const pendingReleases = new Set<CapturedKeybind>();
const observedKeybinds = new Map<string, string>();
const keybindListListeners = new Set<() => void>();
let disabled = false;
let toggleHeld = false;
let initialized = false;
let running = false;
let generation = 0;
let initTimer: ReturnType<typeof setInterval> | null = null;
let shortcutWatchTimer: ReturnType<typeof setInterval> | null = null;
let selectionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTask: Promise<void> | null = null;
let refreshQueued = false;
let baselineReady = false;
let registeredShortcut = "";
let toggleRegistration: {
    shortcut: any[];
    callback: (down: boolean) => void;
    options: any;
} | null = null;
let observedShortcutSetting = "";
let subscribedStore: any = null;
let originalRegister: any = null;
let originalUnregister: any = null;
let registerHook: any = null;
let unregisterHook: any = null;
const recaptureAttempts = new Map<number, {
    signature: string;
    time: number;
}>();
/* =========================================================
 * STREAM DECK
 * ======================================================= */
type StreamDeckStatus = "disabled" | "connecting" | "connected" | "disconnected";
let streamDeckSocket: WebSocket | null = null;
let streamDeckReconnect: ReturnType<typeof setTimeout> | null = null;
let streamDeckStopping = false;
let streamDeckStatus: StreamDeckStatus = "disabled";
type StreamDeckCheckResult = "idle" | "checking" | "ok" | "unavailable" | "noResponse" | "interrupted" | "sendFailed";
type StreamDeckDiagnostics = {
    result: StreamDeckCheckResult;
    checkedAt: number | null;
    attempts: number;
    lastConnectedAt: number | null;
    lastMessageAt: number | null;
};
const initialStreamDeckDiagnostics = (): StreamDeckDiagnostics => ({
    result: "idle", checkedAt: null, attempts: 0, lastConnectedAt: null, lastMessageAt: null
});
let streamDeckDiagnostics = initialStreamDeckDiagnostics();
let streamDeckConnectTimeout: ReturnType<typeof setTimeout> | null = null;
let streamDeckCheck: {
    socket: WebSocket | null;
    timer: ReturnType<typeof setTimeout> | null;
} | null = null;
const streamDeckListeners = new Set<(status: StreamDeckStatus, diagnostics: StreamDeckDiagnostics) => void>();
function getStreamDeckDiagnostics(): StreamDeckDiagnostics {
    return { ...streamDeckDiagnostics };
}
function setStreamDeckStatus(status: StreamDeckStatus) {
    streamDeckStatus = status;
    for (const listener of streamDeckListeners) {
        try {
            listener(status, getStreamDeckDiagnostics());
        }
        catch { }
    }
}
function clearStreamDeckConnectTimeout() {
    if (streamDeckConnectTimeout !== null)
        clearTimeout(streamDeckConnectTimeout);
    streamDeckConnectTimeout = null;
}
function cancelStreamDeckCheck() {
    const check = streamDeckCheck;
    streamDeckCheck = null;
    if (!check)
        return;
    if (check.timer !== null)
        clearTimeout(check.timer);
    if (check.socket) {
        check.socket.onopen = check.socket.onmessage = check.socket.onclose = check.socket.onerror = null;
        try {
            check.socket.close();
        }
        catch { }
    }
}
// A separate, short-lived connection checks the existing companion's getState
// handshake. It sends only the current state, never a toggle command.
function checkStreamDeckConnection() {
    if (!running || !settings.store.streamDeckEnabled || streamDeckDiagnostics.result === "checking")
        return;
    cancelStreamDeckCheck();
    const token = generation;
    const check = { socket: null as WebSocket | null, timer: null as ReturnType<typeof setTimeout> | null };
    streamDeckCheck = check;
    let opened = false;
    const active = () => running && generation === token && settings.store.streamDeckEnabled && streamDeckCheck === check;
    const finish = (result: StreamDeckCheckResult) => {
        if (!active())
            return;
        streamDeckDiagnostics.result = result;
        streamDeckDiagnostics.checkedAt = Date.now();
        cancelStreamDeckCheck();
        setStreamDeckStatus(streamDeckStatus);
    };
    streamDeckDiagnostics.result = "checking";
    streamDeckDiagnostics.checkedAt = null;
    setStreamDeckStatus(streamDeckStatus);
    check.timer = setTimeout(() => finish(opened ? "noResponse" : "unavailable"), 5000);
    try {
        const socket = new WebSocket(STREAM_DECK_URL);
        check.socket = socket;
        socket.onopen = () => {
            if (!active())
                return;
            opened = true;
            try {
                socket.send(JSON.stringify({ type: "hello", role: "diagnostic", protocolVersion: 1 }));
            }
            catch {
                finish("sendFailed");
            }
        };
        socket.onmessage = event => {
            if (!active() || socket.readyState !== WebSocket.OPEN)
                return;
            try {
                const message = JSON.parse(String(event.data));
                if (message?.type !== "getState")
                    return;
            }
            catch {
                return;
            }
            try {
                socket.send(JSON.stringify({ type: "state", disabled }));
                finish("ok");
            }
            catch {
                finish("sendFailed");
            }
        };
        socket.onerror = () => finish(opened ? "interrupted" : "unavailable");
        socket.onclose = () => finish(opened ? "noResponse" : "unavailable");
    }
    catch {
        finish("unavailable");
    }
}
function initialiseStreamDeckPreference() {
    if (settings.store.streamDeckPreferenceInitialized)
        return;
    // Preserve the previously automatic connection when upgrading an existing installation.
    settings.store.streamDeckEnabled = Boolean(settings.plain.selectionInitialized);
    settings.store.streamDeckPreferenceInitialized = true;
}
function sendStreamDeckState() {
    if (!streamDeckSocket || streamDeckSocket.readyState !== WebSocket.OPEN)
        return;
    try {
        streamDeckSocket.send(JSON.stringify({ type: "state", disabled }));
    }
    catch (error) {
        console.error("[ShortcutToggle] Envoi Stream Deck impossible", error);
    }
}
function scheduleStreamDeckReconnect() {
    if (!running || streamDeckStopping || !settings.store.streamDeckEnabled || streamDeckReconnect)
        return;
    streamDeckReconnect = setTimeout(() => {
        streamDeckReconnect = null;
        connectStreamDeck();
    }, 2000);
}
function connectStreamDeck() {
    if (!running || streamDeckStopping || !settings.store.streamDeckEnabled)
        return;
    if (streamDeckSocket && (streamDeckSocket.readyState === WebSocket.OPEN || streamDeckSocket.readyState === WebSocket.CONNECTING))
        return;
    streamDeckDiagnostics.attempts++;
    setStreamDeckStatus("connecting");
    try {
        const socket = new WebSocket(STREAM_DECK_URL);
        streamDeckSocket = socket;
        const active = () => running && !streamDeckStopping && settings.store.streamDeckEnabled && streamDeckSocket === socket;
        const failed = () => {
            if (!active())
                return;
            clearStreamDeckConnectTimeout();
            streamDeckSocket = null;
            socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
            try {
                socket.close();
            }
            catch { }
            setStreamDeckStatus("disconnected");
            scheduleStreamDeckReconnect();
        };
        streamDeckConnectTimeout = setTimeout(() => {
            streamDeckConnectTimeout = null;
            if (active() && socket.readyState !== WebSocket.OPEN)
                failed();
        }, 5000);
        socket.onopen = () => {
            if (!active())
                return;
            clearStreamDeckConnectTimeout();
            streamDeckDiagnostics.lastConnectedAt = Date.now();
            setStreamDeckStatus("connected");
            try {
                socket.send(JSON.stringify({ type: "hello", role: "control", protocolVersion: 1 }));
            }
            catch {
                failed();
                return;
            }
            sendStreamDeckState();
        };
        socket.onmessage = event => {
            if (!active() || socket.readyState !== WebSocket.OPEN)
                return;
            try {
                const message = JSON.parse(String(event.data));
                if (message?.type === "toggle" || message?.type === "getState") {
                    streamDeckDiagnostics.lastMessageAt = Date.now();
                    setStreamDeckStatus(streamDeckStatus);
                    if (message.type === "toggle")
                        toggleKeybinds();
                    else
                        sendStreamDeckState();
                }
            }
            catch (error) {
                console.warn("[ShortcutToggle] Message Stream Deck invalide", error);
            }
        };
        socket.onclose = failed;
        socket.onerror = failed;
    }
    catch {
        setStreamDeckStatus("disconnected");
        scheduleStreamDeckReconnect();
    }
}
function disconnectStreamDeck() {
    streamDeckStopping = true;
    clearStreamDeckConnectTimeout();
    cancelStreamDeckCheck();
    streamDeckDiagnostics.result = "idle";
    streamDeckDiagnostics.checkedAt = null;
    if (!running || !settings.store.streamDeckEnabled)
        streamDeckDiagnostics = initialStreamDeckDiagnostics();
    if (streamDeckReconnect)
        clearTimeout(streamDeckReconnect);
    streamDeckReconnect = null;
    const socket = streamDeckSocket;
    streamDeckSocket = null;
    if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        try {
            socket.close();
        }
        catch { }
    }
    setStreamDeckStatus(!running || !settings.store.streamDeckEnabled ? "disabled" : "disconnected");
}
function updateStreamDeckConnection() {
    if (!running)
        return;
    if (settings.store.streamDeckEnabled) {
        streamDeckStopping = false;
        connectStreamDeck();
    }
    else
        disconnectStreamDeck();
}
function reconnectStreamDeck() {
    if (!running || !settings.store.streamDeckEnabled)
        return;
    disconnectStreamDeck();
    updateStreamDeckConnection();
}
/* =========================================================
 * SYNCHRONISATION DE L'ÉTAT
 * ======================================================= */
const stateListeners = new Set<(state: boolean) => void>();
function notifyState() {
    /*
     * Bouton Discord.
     */
    for (const listener of stateListeners) {
        try {
            listener(disabled);
        }
        catch { }
    }
    /*
     * Stream Deck.
     */
    sendStreamDeckState();
}
/* =========================================================
 * NOTIFICATIONS
 * ======================================================= */
function toast(message: string, success = true) {
    try {
        showToast(message, success
            ? "success"
            : "failure");
    }
    catch { }
}
/* =========================================================
 * ICÔNE DU BOUTON DISCORD
 * ======================================================= */
function ShortcutIcon({ blocked }: {
    blocked: boolean;
}) {
    return (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">

            <path fill="currentColor" d="
                    M4 5
                    C2.9 5 2 5.9 2 7
                    V17
                    C2 18.1 2.9 19 4 19
                    H20
                    C21.1 19 22 18.1 22 17
                    V7
                    C22 5.9 21.1 5 20 5
                    Z

                    M4 7
                    H20
                    V17
                    H4
                    Z

                    M6 9
                    H8
                    V11
                    H6
                    Z

                    M9 9
                    H11
                    V11
                    H9
                    Z

                    M12 9
                    H14
                    V11
                    H12
                    Z

                    M15 9
                    H18
                    V11
                    H15
                    Z

                    M6 13
                    H9
                    V15
                    H6
                    Z

                    M10 13
                    H18
                    V15
                    H10
                    Z
                "/>

            {blocked && (<path d="M4 4L20 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none"/>)}
        </svg>);
}
/* =========================================================
 * BOUTON DISCORD
 * ======================================================= */
function ShortcutToggleButton(props: {
    nameplate?: any;
}) {
    const [blocked, setBlocked] = useState(disabled);
    useEffect(() => {
        const listener = (state: boolean) => {
            setBlocked(state);
        };
        stateListeners.add(listener);
        setBlocked(disabled);
        return () => {
            stateListeners.delete(listener);
        };
    }, []);
    return (<PanelButton tooltipText={blocked
            ? "Réactiver les raccourcis"
            : "Désactiver les raccourcis"} icon={() => (<ShortcutIcon blocked={blocked}/>)} role="switch" aria-checked={blocked} redGlow={blocked} plated={props?.nameplate
            != null} onClick={() => {
            toggleKeybinds();
        }}/>);
}
/* =========================================================
 * MODULES DISCORD
 * ======================================================= */
function resolveModules() {
    try {
        KeybindStore ??=
            findByProps("getKeybindForAction", "hasKeybind", "getUserAgnosticState");
        KeybindActions ??=
            findByProps("addKeybind", "setKeybind", "deleteKeybind", "enableAll");
        NativeInput ??=
            findByProps("inputEventRegister", "inputEventUnregister", "setFocused");
        return Boolean(KeybindStore
            &&
                KeybindActions
            &&
                NativeInput);
    }
    catch (error) {
        console.error("[ShortcutToggle] Modules Discord introuvables", error);
        return false;
    }
}
/* =========================================================
 * RACCOURCIS À CONTRÔLER
 * ======================================================= */
function isCustomKeybind(keybind: any): boolean {
    return Boolean(keybind && !keybind.managed
        && Number.isFinite(Number(keybind.id))
        && Number(keybind.id) !== TOGGLE_ID);
}
function isUsableKeybind(keybind: any): boolean {
    return isCustomKeybind(keybind) && Boolean(keybind.enabled)
        && typeof keybind.action === "string" && keybind.action !== "UNASSIGNED"
        && Array.isArray(keybind.shortcut) && keybind.shortcut.length > 0;
}
function getDiscordState(): Record<string, any> {
    return KeybindStore?.getUserAgnosticState?.() ?? {};
}
function getDiscordKeybind(id: number): any {
    const state = getDiscordState();
    return state[String(id)] ?? Object.values(state).find(keybind => Number(keybind?.id) === id);
}
function keybindSignature(keybind: any): string {
    // Include action parameters as well as the key, action and enabled flag.
    return JSON.stringify(keybind, (_key, value) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
        }
        return value;
    });
}
function getSelectedIds(): Set<string> {
    return new Set((settings.store.selectedKeybindIds ?? []).map(String));
}
function isControlled(id: number): boolean {
    const key = String(id);
    // Protect a new registration even before the deferred store listener runs.
    return getSelectedIds().has(key) || (baselineReady && !observedKeybinds.has(key));
}
function getTargetKeybinds(): any[] {
    return Object.values(getDiscordState()).filter(keybind => isUsableKeybind(keybind) && isControlled(Number(keybind.id)));
}
function initialiseDefaultSelection() {
    if (settings.store.selectionInitialized)
        return;
    settings.store.selectedKeybindIds = getCustomDiscordKeybinds().map(keybind => String(keybind.id));
    settings.store.selectionInitialized = true;
}
function notifyKeybindList() {
    for (const listener of keybindListListeners) {
        try {
            listener();
        }
        catch { }
    }
}
function updateKeybindSnapshot() {
    const current = new Map<string, string>();
    for (const keybind of Object.values(getDiscordState())) {
        if (isCustomKeybind(keybind))
            current.set(String(keybind.id), keybindSignature(keybind));
    }
    const selection = getSelectedIds();
    let selectionChanged = false;
    const conflictSnapshot = JSON.stringify(getDiscordShortcutBindings().map(keybind => [
        String(keybind.id), nativeShortcutSignature(keybind.shortcut), keybind.action, Boolean(keybind.enabled)
    ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    let listChanged = !baselineReady || conflictSnapshot !== observedConflictSnapshot;
    observedConflictSnapshot = conflictSnapshot;
    if (baselineReady) {
        for (const [id, signature] of current) {
            if (!observedKeybinds.has(id)) {
                selection.add(id);
                selectionChanged = true;
            }
            if (observedKeybinds.get(id) !== signature)
                listChanged = true;
        }
        for (const id of observedKeybinds.keys()) {
            if (!current.has(id)) {
                if (selection.delete(id))
                    selectionChanged = true;
                listChanged = true;
            }
        }
    }
    observedKeybinds.clear();
    for (const [id, signature] of current)
        observedKeybinds.set(id, signature);
    baselineReady = true;
    if (selectionChanged)
        settings.store.selectedKeybindIds = [...selection];
    if (listChanged)
        notifyKeybindList();
}
function releaseHeld(item: CapturedKeybind) {
    if (!item.held)
        return;
    item.held = false;
    try {
        item.callback(false);
    }
    catch (error) {
        console.error("[ShortcutToggle] Impossible de libérer le raccourci", item.id, error);
    }
}
function queueHeldRelease(item: CapturedKeybind) {
    if (!item.held)
        return;
    item.held = false;
    pendingReleases.add(item);
}
function flushHeldReleases() {
    for (const item of pendingReleases) {
        pendingReleases.delete(item);
        try {
            item.callback(false);
        }
        catch (error) {
            console.error("[ShortcutToggle] Impossible de libérer le raccourci", item.id, error);
        }
    }
}
function registrationMatches(item: CapturedKeybind, keybind: any): boolean {
    return isUsableKeybind(keybind) && item.signature === keybindSignature(keybind)
        && JSON.stringify(item.shortcut) === JSON.stringify(keybind.shortcut);
}
function releaseBlockedKeybinds() {
    for (const item of captured.values()) {
        const current = getDiscordKeybind(item.id);
        if ((item.custom || isCustomKeybind(current))
            && (!registrationMatches(item, current) || recordingInputSuppressed() || (disabled && isControlled(item.id)))) {
            releaseHeld(item);
        }
    }
}
function installNativeHooks() {
    if (registerHook)
        return;
    const input = NativeInput;
    originalRegister = input.inputEventRegister;
    originalUnregister = input.inputEventUnregister;
    const register = originalRegister;
    const unregister = originalUnregister;
    const token = generation;
    registerHook = function (this: any, eventId: number, shortcut: any[], callback: (down: boolean) => unknown, options: any) {
        const id = Number(eventId);
        if (!running || generation !== token || id === TOGGLE_ID || !Number.isFinite(id)) {
            return register.apply(this, arguments);
        }
        const current = getDiscordKeybind(id);
        const previous = captured.get(id);
        if (previous)
            queueHeldRelease(previous);
        const item: CapturedKeybind = {
            id, shortcut: structuredClone(shortcut), callback, options,
            signature: isCustomKeybind(current) ? keybindSignature(current) : null,
            custom: isCustomKeybind(current), registered: true, held: false,
            guardedCallback: () => { }
        };
        item.guardedCallback = (isDown: boolean) => {
            if (!running || generation !== token)
                return callback(isDown);
            // Ignore obsolete callbacks, including a delayed key-up after replacement.
            if (!item.registered || captured.get(id) !== item)
                return;
            const latest = getDiscordKeybind(id);
            const custom = item.custom || isCustomKeybind(latest);
            if (custom && (!registrationMatches(item, latest) || recordingInputSuppressed() || (disabled && isControlled(id)))) {
                releaseHeld(item);
                return;
            }
            if (!custom)
                return callback(isDown);
            // A release belonging to a press blocked on OFF must not trigger an action on ON.
            if (!isDown && !item.held)
                return;
            item.held = isDown;
            return callback(isDown);
        };
        captured.set(id, item);
        try {
            return register.call(this, eventId, shortcut, item.guardedCallback, options);
        }
        catch (error) {
            item.registered = false;
            if (previous)
                captured.set(id, previous);
            else
                captured.delete(id);
            throw error;
        }
        finally {
            enqueueKeybindRefresh();
        }
    };
    unregisterHook = function (this: any, eventId: number) {
        if (running && generation === token && Number(eventId) !== TOGGLE_ID) {
            const item = captured.get(Number(eventId));
            if (item) {
                queueHeldRelease(item);
                item.registered = false;
            }
            // An external unregister is respected: OFF/ON will never replay it.
            enqueueKeybindRefresh();
        }
        return unregister.apply(this, arguments);
    };
    input.inputEventRegister = registerHook;
    input.inputEventUnregister = unregisterHook;
}
function removeNativeHooks() {
    if (!NativeInput || !registerHook)
        return;
    const input = NativeInput;
    if (input.inputEventRegister === registerHook)
        input.inputEventRegister = originalRegister;
    if (input.inputEventUnregister === unregisterHook)
        input.inputEventUnregister = originalUnregister;
    // Remove callback guards using only registrations Discord still considers current.
    for (const item of captured.values()) {
        if (!item.registered)
            continue;
        const current = getDiscordKeybind(item.id);
        try {
            if ((item.custom || isCustomKeybind(current)) && !registrationMatches(item, current)) {
                originalUnregister.call(input, item.id);
            }
            else {
                originalRegister.call(input, item.id, item.shortcut, item.callback, item.options);
            }
        }
        catch (error) {
            console.error("[ShortcutToggle] Nettoyage du raccourci impossible", item.id, error);
        }
    }
    registerHook = null;
    unregisterHook = null;
    originalRegister = null;
    originalUnregister = null;
}
function scheduleSelectedKeybindRefresh() {
    if (!running || !NativeInput || !registerHook)
        return;
    // This check is synchronous, including changes made outside our selector.
    releaseBlockedKeybinds();
    enqueueKeybindRefresh();
}
function enqueueKeybindRefresh() {
    if (!running || !NativeInput || !registerHook)
        return;
    if (refreshTask) {
        refreshQueued = true;
        return;
    }
    if (selectionRefreshTimer)
        return;
    selectionRefreshTimer = setTimeout(() => {
        selectionRefreshTimer = null;
        void refreshSelectedKeybinds();
    }, 0);
}
async function reconcileKeybinds(token: number) {
    flushHeldReleases();
    updateKeybindSnapshot();
    releaseBlockedKeybinds();
    // Remove deleted registrations and their callbacks; never restore them on ON.
    for (const [id, item] of captured) {
        const current = getDiscordKeybind(id);
        if (item.custom && !isCustomKeybind(current)) {
            if (item.registered)
                NativeInput.inputEventUnregister(id);
            captured.delete(id);
            recaptureAttempts.delete(id);
        }
    }
    // Capture all custom keys, so selecting an existing key while OFF takes effect immediately.
    const ids = Object.values(getDiscordState()).filter(isUsableKeybind).map(keybind => Number(keybind.id));
    for (const id of ids) {
        if (!running || generation !== token)
            return;
        const current = getDiscordKeybind(id);
        if (!isUsableKeybind(current))
            continue;
        const item = captured.get(id);
        if (item && registrationMatches(item, current)) {
            recaptureAttempts.delete(id);
            continue;
        }
        const signature = keybindSignature(current);
        const attempt = recaptureAttempts.get(id);
        // A failed capture is retried without flooding Discord or blocking the hotkey.
        if (attempt?.signature === signature && Date.now() - attempt.time < 2000)
            continue;
        recaptureAttempts.set(id, { signature, time: Date.now() });
        try {
            // Read immediately before dispatch; retain Discord's own enabled flag and options.
            await KeybindActions.setKeybind({ ...current });
            if (!running || generation !== token)
                return;
            const latest = captured.get(id);
            if (latest && registrationMatches(latest, getDiscordKeybind(id)))
                recaptureAttempts.delete(id);
        }
        catch (error) {
            console.error("[ShortcutToggle] Capture du raccourci impossible", id, error);
        }
    }
}
function refreshSelectedKeybinds(): Promise<void> {
    if (!running || !registerHook)
        return Promise.resolve();
    if (refreshTask) {
        refreshQueued = true;
        return refreshTask;
    }
    const token = generation;
    // Defer to the next microtask, so even synchronous registrations see the assigned task.
    const task = Promise.resolve().then(async () => {
        do {
            refreshQueued = false;
            if (!running || generation !== token)
                return;
            await reconcileKeybinds(token);
        } while (refreshQueued && running && generation === token);
    }).catch(error => {
        console.error("[ShortcutToggle] Synchronisation des raccourcis impossible", error);
    }).finally(() => {
        if (refreshTask === task)
            refreshTask = null;
    });
    refreshTask = task;
    return task;
}
function onDiscordKeybindChange() {
    // No Discord action is dispatched inside a Flux store listener.
    enqueueKeybindRefresh();
}
function setDisabled(next: boolean) {
    if (!running)
        return;
    disabled = next;
    releaseBlockedKeybinds();
    scheduleSelectedKeybindRefresh();
    notifyState();
    const count = getTargetKeybinds().length;
    toast(next ? `${count} raccourci(s) désactivé(s)` : `${count} raccourci(s) réactivé(s)`, !next);
}
function disableKeybinds() { setDisabled(true); }
function enableKeybinds() { setDisabled(false); }
function toggleKeybinds() {
    if (disabled)
        enableKeybinds();
    else
        disableKeybinds();
}
/* =========================================================
 * RACCOURCI PERSONNALISABLE
 * ======================================================= */
function registerToggleShortcut(): boolean {
    let shortcutText = getShortcutSetting();
    observedShortcutSetting = shortcutText;
    let shortcut = parseShortcut(shortcutText);
    if (!shortcut) {
        toast(`Raccourci invalide : ${shortcutText}`, false);
        if (toggleRegistration)
            return true;
        // Keep the last working hotkey after a restart with invalid saved input.
        shortcutText = String(settings.store.lastValidToggleShortcut ?? "F13");
        shortcut = parseShortcut(shortcutText);
        if (!shortcut) {
            shortcutText = "F13";
            shortcut = parseShortcut(shortcutText)!;
        }
    }
    const token = generation;
    const next = {
        shortcut,
        callback: (isDown: boolean) => {
            if (!running || generation !== token)
                return;
            if (recordingInputSuppressed()) {
                toggleHeld = isDown;
                return;
            }
            if (isDown) {
                if (toggleHeld)
                    return;
                toggleHeld = true;
                toggleKeybinds();
            }
            else {
                toggleHeld = false;
            }
        },
        options: { focused: true, blurred: true, keydown: true, keyup: true }
    };
    const previous = toggleRegistration;
    try {
        NativeInput.inputEventUnregister(TOGGLE_ID);
        NativeInput.inputEventRegister(TOGGLE_ID, next.shortcut, next.callback, next.options);
        toggleHeld = false;
        toggleRegistration = next;
        registeredShortcut = shortcutText;
        settings.store.lastValidToggleShortcut = shortcutText;
        notifyShortcutRecording();
        toast(`Raccourci : ${shortcutText}`);
        return true;
    }
    catch (error) {
        console.error("[ShortcutToggle] Erreur enregistrement raccourci", error);
        if (previous) {
            try {
                NativeInput.inputEventRegister(TOGGLE_ID, previous.shortcut, previous.callback, previous.options);
                return true;
            }
            catch (restoreError) {
                console.error("[ShortcutToggle] Restauration du hotkey impossible", restoreError);
            }
        }
        return false;
    }
}
/* =========================================================
 * SURVEILLANCE DES PARAMÈTRES
 * ======================================================= */
function startShortcutWatcher() {
    if (shortcutWatchTimer)
        clearInterval(shortcutWatchTimer);
    shortcutWatchTimer = setInterval(() => {
        if (!running || !initialized)
            return;
        if (getShortcutSetting() !== observedShortcutSetting)
            registerToggleShortcut();
        // Polling also covers a Discord build without usable store change listeners,
        // missed notifications and settings imported from another Vencord instance.
        scheduleSelectedKeybindRefresh();
    }, 500);
}
function initialise(): boolean {
    if (!running || initialized)
        return initialized;
    if (!resolveModules())
        return false;
    initialiseDefaultSelection();
    updateKeybindSnapshot();
    installNativeHooks();
    if (!subscribedStore && typeof KeybindStore.addChangeListener === "function") {
        try {
            KeybindStore.addChangeListener(onDiscordKeybindChange);
            subscribedStore = KeybindStore;
        }
        catch (error) {
            console.warn("[ShortcutToggle] Surveillance Discord par vérification périodique", error);
        }
    }
    if (!registerToggleShortcut())
        return false;
    initialized = true;
    startShortcutWatcher();
    scheduleSelectedKeybindRefresh();
    notifyState();
    console.log("[ShortcutToggle] Initialisation terminée — Hotkey :", registeredShortcut || "aucun");
    return true;
}
/* =========================================================
 * PLUGIN
 * ======================================================= */
export default definePlugin({
    name: "ShortcutToggle",
    description: "Active ou désactive les raccourcis Discord depuis un bouton, un raccourci personnalisable ou un Stream Deck.",
    authors: [
        {
            name: "Ethan",
            id: 942412303800893440n
        }
    ],
    // Unified settings panel.
    settings,
    /*
     * Ajoute le bouton
     * à côté du micro/casque.
     */
    patches: [
        {
            find: "#{intl::USER_PROFILE_ACCOUNT_POPOUT_BUTTON_A11Y_LABEL}",
            replacement: {
                match: /children:\[(?=[^}]*accountContainerRef)/,
                replace: "children:[$self.shortcutToggleButton(arguments[0]),"
            }
        }
    ],
    shortcutToggleButton: ErrorBoundary.wrap(ShortcutToggleButton, {
        noop: true
    }),
    start() {
        if (running)
            return;
        running = true;
        generation++;
        initialiseStreamDeckPreference();
        updateStreamDeckConnection();
        startUpdateChecks();
        let attempts = 0;
        initTimer = setInterval(() => {
            if (!running)
                return;
            let ok = false;
            try {
                ok = initialise();
            }
            catch (error) {
                console.error("[ShortcutToggle] Initialisation impossible", error);
            }
            if (ok || ++attempts >= 20) {
                if (initTimer)
                    clearInterval(initTimer);
                initTimer = null;
                if (!ok)
                    toast("ShortcutToggle n'a pas pu démarrer. Consulte la console Discord.", false);
            }
        }, 500);
    },
    stop() {
        cancelShortcutRecording();
        shortcutSuppressUntil = 0;
        running = false;
        generation++;
        stopUpdateChecks();
        if (initTimer)
            clearInterval(initTimer);
        if (shortcutWatchTimer)
            clearInterval(shortcutWatchTimer);
        if (selectionRefreshTimer)
            clearTimeout(selectionRefreshTimer);
        initTimer = null;
        shortcutWatchTimer = null;
        selectionRefreshTimer = null;
        refreshQueued = false;
        refreshTask = null;
        if (subscribedStore) {
            try {
                subscribedStore.removeChangeListener(onDiscordKeybindChange);
            }
            catch { }
            subscribedStore = null;
        }
        for (const item of captured.values())
            releaseHeld(item);
        flushHeldReleases();
        removeNativeHooks();
        if (NativeInput) {
            try {
                NativeInput.inputEventUnregister(TOGGLE_ID);
            }
            catch { }
        }
        disconnectStreamDeck();
        captured.clear();
        recaptureAttempts.clear();
        observedKeybinds.clear();
        baselineReady = false;
        observedConflictSnapshot = "";
        KeybindStore = null;
        KeybindActions = null;
        NativeInput = null;
        disabled = false;
        toggleHeld = false;
        initialized = false;
        registeredShortcut = "";
        toggleRegistration = null;
        observedShortcutSetting = "";
        notifyState();
        notifyKeybindList();
        console.log("[ShortcutToggle] Plugin arrêté");
    }
});
