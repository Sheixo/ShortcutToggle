/* ShortcutToggle — Copyright (c) 2026 Ethan. SPDX-License-Identifier: GPL-3.0-or-later */
export const COMPANION_VERSION = "0.1.4.0";
export const REPOSITORY_URL = "https://github.com/Sheixo/ShortcutToggle";
export const INSTALLER_NAME = "fr.ethan.discord-shortcuts.streamDeckPlugin";
export const UPDATE_DESCRIPTOR = "streamdeck-update.json";
export const PLUGIN_UUID = "fr.ethan.discord-shortcuts";
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
type RecordValue = { [key: string]: unknown };
type Release = { tag_name: string; draft: false; assets: RecordValue[] };
export type UpdateView = {
    installedVersion: string; automaticChecks: boolean; initialized: boolean;
    status: "idle" | "checking" | "current" | "available" | "error";
    lastCheckedAt: number; latestVersion: string; releaseTag: string; message: string;
    downloadUrl: string; releaseUrl: string;
};
type Dependencies = {
    readSettings: () => Promise<RecordValue>;
    writeSettings: (value: RecordValue) => Promise<void>;
    request: typeof fetch;
};
function record(value: unknown): value is RecordValue { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function compareCompanionVersions(a: string, b: string): number | null {
    const pattern = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
    if (!pattern.test(a) || !pattern.test(b)) return null;
    const left = a.split(".").map(Number), right = b.split(".").map(Number);
    for (let i = 0; i < 4; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
    return 0;
}
function validTag(value: unknown): value is string {
    return typeof value === "string" && /^v?\d{1,9}\.\d{1,9}\.\d{1,9}(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$/.test(value) && value.length < 100;
}
function hasAsset(release: Release, name: string) {
    return release.assets.find(asset => asset.name === name && asset.state === "uploaded");
}

// Settings are stored by Stream Deck. Distributed files and the DRM-protected manifest are never read or modified.
export class CompanionUpdates {
    private settings: RecordValue = {};
    private initialization: Promise<void> | null = null;
    private pending: Promise<void> | null = null;
    private writeQueue: Promise<void> = Promise.resolve();
    private scheduled: ReturnType<typeof setTimeout> | null = null;
    private controller: AbortController | null = null;
    private stopped = false;
    private generation = 0;
    private readonly listeners = new Set<() => void>();
    private view: UpdateView;

    constructor(installedVersion: string, private readonly dependencies: Dependencies) {
        this.view = { installedVersion: compareCompanionVersions(installedVersion, installedVersion) === 0 ? installedVersion : COMPANION_VERSION,
            automaticChecks: true, initialized: false, status: "idle", lastCheckedAt: 0, latestVersion: "", releaseTag: "",
            message: "Clique sur Rechercher les mises à jour.", downloadUrl: "", releaseUrl: "" };
    }
    getView(): UpdateView { return { ...this.view }; }
    subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    private notify() { for (const listener of this.listeners) { try { listener(); } catch {} } }
    private availability() {
        const newer = compareCompanionVersions(this.view.latestVersion, this.view.installedVersion) === 1 && validTag(this.view.releaseTag);
        this.view.downloadUrl = newer ? `${REPOSITORY_URL}/releases/download/${encodeURIComponent(this.view.releaseTag)}/${INSTALLER_NAME}` : "";
        this.view.releaseUrl = newer ? `${REPOSITORY_URL}/releases/tag/${encodeURIComponent(this.view.releaseTag)}` : "";
        return newer;
    }
    async initialize() {
        if (this.stopped) return;
        if (!this.initialization) this.initialization = (async () => {
            let deadline: ReturnType<typeof setTimeout> | undefined;
            const settings = await Promise.race([this.dependencies.readSettings(), new Promise<RecordValue>((_, reject) => {
                deadline = setTimeout(() => reject(new Error("Settings response timed out")), 10000);
            })]).finally(() => { if (deadline !== undefined) clearTimeout(deadline); });
            if (this.stopped) return;
            this.settings = record(settings) ? settings : {};
            const saved = this.settings.companionUpdates;
            if (record(saved)) {
                this.view.automaticChecks = saved.automaticChecks !== false;
                if (typeof saved.lastCheckedAt === "number" && Number.isFinite(saved.lastCheckedAt) && saved.lastCheckedAt > 0 && saved.lastCheckedAt <= Date.now())
                    this.view.lastCheckedAt = saved.lastCheckedAt;
                if (typeof saved.latestVersion === "string" && compareCompanionVersions(saved.latestVersion, saved.latestVersion) === 0 && validTag(saved.releaseTag)) {
                    this.view.latestVersion = saved.latestVersion; this.view.releaseTag = saved.releaseTag;
                }
            }
            this.view.initialized = true;
            if (this.availability()) { this.view.status = "available"; this.view.message = `Version ${this.view.latestVersion} disponible.`; }
            else if (this.view.lastCheckedAt) { this.view.status = "current"; this.view.message = "Aucune version plus récente connue."; }
            this.notify(); this.schedule(20000);
        })().catch(error => {
            this.initialization = null;
            this.view.status = "error"; this.view.message = "Impossible de charger les préférences. Réessaie la vérification.";
            this.notify(); throw error;
        });
        return this.initialization;
    }
    private save(): Promise<void> {
        const snapshot = { automaticChecks: this.view.automaticChecks, lastCheckedAt: this.view.lastCheckedAt,
            latestVersion: this.view.latestVersion, releaseTag: this.view.releaseTag };
        this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
            await this.dependencies.writeSettings({ ...this.settings, companionUpdates: snapshot });
            this.settings = { ...this.settings, companionUpdates: snapshot };
        });
        return this.writeQueue;
    }
    private schedule(delay?: number, force = false) {
        if (this.scheduled !== null) clearTimeout(this.scheduled);
        this.scheduled = null;
        if (this.stopped || !this.view.initialized || !this.view.automaticChecks) return;
        const wait = delay ?? (this.view.lastCheckedAt ? Math.max(1000, DAY - (Date.now() - this.view.lastCheckedAt)) : 20000);
        this.scheduled = setTimeout(() => {
            this.scheduled = null;
            if (!force && Date.now() - this.view.lastCheckedAt < DAY && this.view.lastCheckedAt > 0) { this.schedule(); return; }
            void this.check().catch(() => {});
        }, wait);
    }
    async setAutomaticChecks(enabled: boolean) {
        await this.initialize();
        if (this.stopped || !this.view.initialized) return;
        const previous = this.view.automaticChecks;
        this.view.automaticChecks = enabled;
        if (!enabled) { this.generation++; this.controller?.abort(); }
        this.notify(); this.schedule();
        try { await this.save(); }
        catch { this.view.automaticChecks = previous; this.view.message = "Préférence non enregistrée. Réessaie."; this.schedule(); this.notify(); }
    }
    async check() {
        await this.initialize();
        if (this.stopped || !this.view.initialized) return;
        if (this.pending) return this.pending;
        const generation = this.generation;
        this.view.status = "checking"; this.view.message = "Recherche en cours…"; this.notify();
        const controller = new AbortController(); this.controller = controller;
        const timeout = setTimeout(() => controller.abort(), 10000);
        this.pending = (async () => {
            let retry = false;
            const current = () => !this.stopped && generation === this.generation;
            try {
                const options = { signal: controller.signal, credentials: "omit" as const,
                    headers: { Accept: "application/vnd.github+json" } };
                const response = await this.dependencies.request("https://api.github.com/repos/Sheixo/ShortcutToggle/releases?per_page=100", options);
                if (!response.ok) throw new Error("GitHub response unavailable");
                const data: unknown = await response.json();
                if (!current()) return;
                if (!Array.isArray(data)) throw new Error("Invalid release list");
                // GitHub returns newest publications first. Only releases with companion metadata qualify.
                const releases = data.slice(0, 100).filter((item): item is Release => record(item) && item.draft === false
                    && validTag(item.tag_name) && Array.isArray(item.assets) && item.assets.every(record)
                    && !!hasAsset(item as Release, UPDATE_DESCRIPTOR) && !!hasAsset(item as Release, INSTALLER_NAME));
                let candidate: { version: string; tag: string } | null = null;
                for (const release of releases.slice(0, 10)) {
                    if (!current()) return;
                    const metadataResponse = await this.dependencies.request(`${REPOSITORY_URL}/releases/download/${encodeURIComponent(release.tag_name)}/${UPDATE_DESCRIPTOR}`, options);
                    if (!metadataResponse.ok) throw new Error("Companion metadata unavailable");
                    const text = await metadataResponse.text();
                    if (!current()) return;
                    if (text.length > 8192) throw new Error("Companion metadata too large");
                    const metadata: unknown = JSON.parse(text), installer = hasAsset(release, INSTALLER_NAME)!;
                    if (!record(metadata) || metadata.schemaVersion !== 1 || metadata.pluginUUID !== PLUGIN_UUID
                        || metadata.releaseTag !== release.tag_name || metadata.installer !== INSTALLER_NAME
                        || typeof metadata.version !== "string" || compareCompanionVersions(metadata.version, metadata.version) !== 0
                        || typeof metadata.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(metadata.sha256)
                        || metadata.size !== installer.size || installer.digest !== `sha256:${metadata.sha256}`)
                        throw new Error("Invalid companion metadata");
                    if (!candidate || compareCompanionVersions(metadata.version, candidate.version) === 1)
                        candidate = { version: metadata.version, tag: release.tag_name };
                }
                if (!current()) return;
                if (!candidate) throw new Error("No published companion metadata");
                this.view.latestVersion = candidate.version; this.view.releaseTag = candidate.tag; this.view.lastCheckedAt = Date.now();
                this.view.status = this.availability() ? "available" : "current";
                this.view.message = this.view.status === "available" ? `Version ${candidate.version} disponible.` : "Ton compagnon est à jour.";
                try { await this.save(); }
                catch { this.view.message += " Résultat non mémorisé ; réessaie plus tard."; }
            } catch {
                if (!current()) return;
                retry = true; this.view.status = "error";
                this.view.message = "Vérification impossible. Vérifie Internet puis réessaie ; le dernier résultat est conservé.";
            } finally {
                clearTimeout(timeout);
                if (this.controller === controller) this.controller = null;
                this.pending = null;
                if (!this.stopped) {
                    if (!current()) {
                        this.view.status = this.availability() ? "available" : "idle";
                        this.view.message = "Recherche annulée. La vérification manuelle reste disponible.";
                    }
                    this.notify(); this.schedule(retry ? HOUR : undefined, retry);
                }
            }
        })();
        return this.pending;
    }
    stop() {
        this.stopped = true; this.generation++; this.controller?.abort();
        if (this.scheduled !== null) clearTimeout(this.scheduled);
        this.scheduled = null; this.listeners.clear();
    }
}
