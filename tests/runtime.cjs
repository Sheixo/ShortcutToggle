const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function createRuntime(code, { order = 'storeFirst', selection = ['1'], delay = false, fresh = false, preference, socketConnecting = false } = {}) {
    let clock = 0, nextTimer = 1, dispatching = false;
    const timers = new Map(), entries = new Map(), listeners = new Set(), calls = [], writes = [], sockets = [], errors = [];
    const state = {
        1: { id: 1, shortcut: [[0, 71]], action: 'PUSH_TO_MUTE', enabled: true, managed: false },
        2: { id: 2, shortcut: [[0, 66]], action: 'TOGGLE_MUTE', enabled: true, managed: false },
        3: { id: 3, shortcut: [[0, 72]], action: 'PUSH_TO_TALK', enabled: false, managed: false }
    };
    let deferred = null;
    let toggleRegisterFailures = 0;
    let socketConstructorFailures = 0;
    const requests = [], notifications = [], openedUrls = [];
    let fetchHandler = async () => ({ ok: true, status: 200, json: async () => [{ tag_name: 'v0.2.0', draft: false, prerelease: true }] });
    class DomSurface {
        constructor() { this.handlers = new Map(); this.hidden = false; }
        addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); }
        removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
        emit(type, event = {}) { for (const fn of [...(this.handlers.get(type) ?? [])]) fn(event); }
        count() { return [...this.handlers.values()].reduce((sum, handlers) => sum + handlers.size, 0); }
    }
    const document = new DomSurface(), window = new DomSurface();
    const native = {
        inputEventRegister(id, shortcut, callback, options) {
            if (Number(id) === 1396921420 && toggleRegisterFailures) { toggleRegisterFailures--; throw new Error('Simulated native registration failure'); }
            entries.set(Number(id), { shortcut: structuredClone(shortcut), callback, options });
        },
        inputEventUnregister(id) { entries.delete(Number(id)); },
        setFocused() {}
    };
    const originals = { register: native.inputEventRegister, unregister: native.inputEventUnregister };
    function actionCallback(keybind) {
        return down => {
            assert.equal(dispatching, false, 'Action callback dispatched inside Flux listener');
            calls.push({ id: keybind.id, action: keybind.action, shortcut: keybind.shortcut, down });
        };
    }
    function registerKeybind(k) {
        native.inputEventUnregister(k.id);
        if (k.enabled && k.action !== 'UNASSIGNED' && k.shortcut.length) {
            native.inputEventRegister(k.id, k.shortcut, actionCallback(structuredClone(k)), { focused: true, blurred: true, keydown: true, keyup: true });
        }
    }
    function emit() {
        dispatching = true;
        try { for (const listener of listeners) listener(); }
        finally { dispatching = false; }
    }
    function put(k) {
        const copy = structuredClone(k);
        if (order === 'registerFirst') {
            registerKeybind(copy);
            state[copy.id] = copy;
            emit();
        } else {
            state[copy.id] = copy;
            emit();
            registerKeybind(copy);
        }
    }
    const storeModule = { getUserAgnosticState: () => state, getKeybindForAction() {}, hasKeybind() {}, addChangeListener: f => listeners.add(f), removeChangeListener: f => listeners.delete(f) };
    const actions = {
        setKeybind(k) {
            writes.push(structuredClone(k));
            put(k);
            if (delay && !deferred) {
                let resolve;
                const promise = new Promise(r => { resolve = r; });
                deferred = { promise, resolve };
                return promise;
            }
        },
        addKeybind: put, deleteKeybind() {}, enableAll() {}
    };
    let definition;
    let componentScope = null, hookIndex = 0;
    const componentHooks = new Map();
    const effectCleanup = new Map();
    const hookUpdates = [];
    const useStateMock = initial => {
        if (!componentScope) return [typeof initial === 'function' ? initial() : initial, () => {}];
        const scope = componentScope;
        const index = hookIndex++;
        if (!componentHooks.has(scope)) componentHooks.set(scope, []);
        const slots = componentHooks.get(scope);
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; hookUpdates.push(scope); }];
    };
    const useEffectMock = effect => {
        if (!componentScope) return;
        const key = componentScope + ':' + hookIndex++;
        if (!effectCleanup.has(key)) effectCleanup.set(key, effect());
    };
    const settingsApi = {
        Settings: { plugins: {} },
        useSettings() { return settingsApi.Settings; },
        definePluginSettings(def) {
            definition = def;
            const plain = Object.fromEntries(Object.entries(def).filter(([, value]) => 'default' in value).map(([key, value]) => [key, structuredClone(value.default)]));
            plain.selectedKeybindIds = selection;
            plain.selectionInitialized = !fresh;
            if (preference !== undefined) { plain.streamDeckEnabled = preference; plain.streamDeckPreferenceInitialized = true; }
            const store = new Proxy(plain, { set(obj, key, value) { obj[key] = value; def[key]?.onChange?.(value); return true; } });
            return { store, plain, use: () => store, def };
        }
    };
    let settings;
    const originalDefine = settingsApi.definePluginSettings;
    settingsApi.definePluginSettings = def => {
        settings = originalDefine(def);
        settingsApi.Settings.plugins.ShortcutToggle = settings.store;
        return settings;
    };
    class WebSocketMock {
        static OPEN = 1;
        static CONNECTING = 0;
        constructor(url) {
            if (socketConstructorFailures) { socketConstructorFailures--; throw new Error('Simulated WebSocket constructor failure'); }
            this.url = url; this.readyState = socketConnecting ? 0 : 1; this.messages = []; sockets.push(this);
        }
        send(msg) { this.messages.push(JSON.parse(msg)); }
        close() { this.readyState = 3; this.onclose?.(); }
    }
    function timer(fn, ms, repeat = 0) { const id = nextTimer++; timers.set(id, { fn, time: clock + ms, repeat }); return id; }
    const context = {
        module: { exports: {} }, exports: {}, structuredClone, document, window,
        Date: class extends Date { static now() { return clock; } },
        console: { log() {}, warn() {}, error(...args) { errors.push(args.map(String).join(' ')); } },
        WebSocket: WebSocketMock,
        AbortController,
        fetch: (url, options) => { requests.push({ url, options }); return fetchHandler(url, options); },
        VencordNative: { native: { openExternal: url => { openedUrls.push(url); } } },
        setTimeout: (fn, ms) => timer(fn, ms), clearTimeout: id => timers.delete(id),
        setInterval: (fn, ms) => timer(fn, ms, ms), clearInterval: id => timers.delete(id),
        require(name) {
            if (name === '@api/Settings') return settingsApi;
            if (name === '@api/Notifications') return { showNotification: async notification => { notifications.push(notification); } };
            if (name === '@components/ErrorBoundary') return { __esModule: true, default: { wrap: c => c } };
            if (name === '@components/settings/tabs/plugins/PluginModalButtons') return { FavoriteButton() {} };
            if (name === '@utils/types') return { __esModule: true, default: p => p, OptionType: { STRING: 1, CUSTOM: 2, BOOLEAN: 3, COMPONENT: 4 } };
            if (name === '@webpack') return { findComponentByCodeLazy: () => () => {}, findByProps: (...props) => props[0] === 'getKeybindForAction' ? storeModule : props[0] === 'addKeybind' ? actions : native };
            if (name === '@webpack/common') return { Checkbox() {}, Forms: {}, showToast() {}, Toasts: { Type: { SUCCESS: 1, FAILURE: 0 } }, useEffect: useEffectMock, useState: useStateMock };
            if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
            throw new Error('Unexpected import ' + name);
        }
    };
    // Native registrations already exist when the plugin starts.
    for (const keybind of Object.values(state)) registerKeybind(keybind);
    vm.runInNewContext(code, context, { filename: 'ShortcutToggle.cjs' });
    const plugin = context.module.exports.default;
    async function tick(ms = 0) {
        clock += ms;
        for (let round = 0; round < 30; round++) {
            const due = [...timers].filter(([, t]) => t.time <= clock);
            for (const [id, t] of due) {
                if (!timers.has(id)) continue;
                if (t.repeat) t.time = clock + t.repeat;
                else timers.delete(id);
                await t.fn();
            }
            await Promise.resolve();
            await Promise.resolve();
            if (!due.length && round >= 10) break;
        }
    }
    const fire = (id, down = true) => entries.get(Number(id))?.callback(down);
    const press = id => { fire(id, true); fire(id, false); };
    const toggle = () => press(1396921420);
    const latestState = () => sockets.at(-1)?.messages.at(-1)?.disabled;
    async function start() { plugin.start(); await tick(500); await tick(); }
    return { plugin, recorder: context.module.exports.__test ?? context.module.exports.recorder, testApi: context.module.exports.__test, render(component) { componentScope = component.name; hookIndex = 0; const tree = component(); componentScope = null; return tree; }, unmount() { for (const cleanup of effectCleanup.values()) cleanup?.(); effectCleanup.clear(); componentHooks.clear(); }, document, window, failNextToggleRegister: () => { toggleRegisterFailures = 1; }, settings: () => settings.store, definition: () => definition, state, native, entries, originals, listeners, calls, writes, sockets, errors, start, tick, fire, press, toggle, latestState, put, releaseDeferred: () => deferred?.resolve(),
        remove(id) { native.inputEventUnregister(id); delete state[id]; emit(); },
        hookUpdates,
        requests, notifications, openedUrls,
        setFetchHandler: handler => { fetchHandler = handler; },
        failNextSocket: () => { socketConstructorFailures = 1; },
        patch(id, values) { put({ ...state[id], ...values }); }
    };
}


module.exports = { createRuntime };
