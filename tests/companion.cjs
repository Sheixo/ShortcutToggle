const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild');
const { createRuntime } = require('./runtime.cjs');
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function fixture() {
    let clock = 0, next = 1;
    const timers = new Map(), servers = [], warnings = [], errors = [];
    const timer = (fn, delay, repeat = 0) => { const id = next++; timers.set(id, { fn, at: clock + delay, repeat }); return id; };
    class Emitter {
        handlers = new Map();
        on(name, fn) { if (!this.handlers.has(name)) this.handlers.set(name, []); this.handlers.get(name).push(fn); return this; }
        emit(name, ...args) { for (const handler of this.handlers.get(name) || []) handler(...args); }
    }
    class Socket extends Emitter {
        readyState = 1; packets = []; autoPong = true; terminated = 0; sendError = false;
        send(value, callback) { this.packets.push(JSON.parse(value)); if (this.sendError) callback?.(new Error('Send failed')); else callback?.(); }
        ping(_data, _mask, callback) { if (this.autoPong) this.emit('pong'); callback?.(); }
        terminate() { this.terminated++; this.readyState = 3; this.emit('close'); }
        message(value) { this.emit('message', { toString: () => typeof value === 'string' ? value : JSON.stringify(value) }); }
    }
    class Server extends Emitter {
        constructor(options) { super(); this.options = options; servers.push(this); }
        close(callback) { this.emit('close'); callback?.(); }
        connect() { const socket = new Socket(); this.emit('connection', socket); return socket; }
    }
    const sdk = { logger: { info() {}, warn: value => warnings.push(value), error: value => errors.push(value) },
        action: () => value => value, SingletonAction: class {} };
    const common = { exports: {}, Date: class extends Date { static now() { return clock; } },
        setTimeout: (fn, delay) => timer(fn, delay), clearTimeout: id => timers.delete(id),
        setInterval: (fn, delay) => timer(fn, delay, delay), clearInterval: id => timers.delete(id),
        process: { once() {} } };
    function load(source, dependency) {
        const context = { ...common, module: { exports: {} }, exports: {}, require(name) {
            if (name === '@elgato/streamdeck') return { __esModule: true, default: sdk, ...sdk };
            if (name === 'ws') return { WebSocket: { OPEN: 1 }, WebSocketServer: Server };
            if (name === '../bridge') return dependency;
            throw new Error('Unexpected companion import: ' + name);
        } };
        const compiled = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'node20' }).code;
        vm.runInNewContext(compiled, context);
        return context.module.exports;
    }
    const bridgeSource = fs.readFileSync(path.resolve(__dirname, '../stream-deck/src/bridge.ts'), 'utf8');
    const actionSource = fs.readFileSync(path.resolve(__dirname, '../stream-deck/src/actions/discord-shortcuts.ts'), 'utf8');
    const bridge = load(bridgeSource), Action = load(actionSource, bridge).DiscordShortcutsAction;
    const key = id => ({ id, isKey: () => true, history: [], shownState: null, shownImage: null, shownTitle: null, alerts: 0,
        async setState(value) { this.shownState = value; this.history.push(['state', value]); },
        async setImage(value) { this.shownImage = value; this.history.push(['image', value]); },
        async setTitle(value) { this.shownTitle = value; this.history.push(['title', value]); },
        async showAlert() { this.alerts++; } });
    async function tick(delay) {
        clock += delay;
        for (let round = 0; round < 20; round++) {
            const due = [...timers].filter(([, value]) => value.at <= clock);
            if (!due.length) break;
            for (const [id, value] of due) {
                if (!timers.has(id)) continue;
                if (value.repeat) value.at = clock + value.repeat; else timers.delete(id);
                value.fn();
            }
        }
        await flush();
    }
    return { bridge, Action, key, servers, Socket, tick, warnings, errors };
}
async function main(vencordCode) {
    let checks = 0;
    const f = fixture(), b = f.bridge, action = new f.Action(), first = f.key('first');
    await action.onWillAppear({ action: first });
    assert.equal(first.shownImage, 'imgs/disconnected.svg'); assert.equal(first.shownTitle, 'Hors ligne');
    assert.equal(b.getState().connected, false); checks++;
    await action.onKeyDown({ action: first }); assert.equal(first.alerts, 1); checks++;
    assert.equal(f.servers[0].options.host, '127.0.0.1'); assert.equal(f.servers[0].options.maxPayload, 4096); checks++;
    const control = f.servers[0].connect();
    assert.equal(b.getState().connected, false);
    assert.equal(control.packets[0].type, 'getState'); checks++;
    control.message({ type: 'hello', role: 'control', protocolVersion: 1 });
    control.message({ type: 'state', disabled: 'false' });
    assert.equal(b.getState().connected, false); checks++;
    control.message({ type: 'state', disabled: false }); await flush();
    assert.equal(b.getState().connected, true); assert.equal(first.shownState, 0);
    assert.equal(first.shownImage, undefined); assert.equal(first.shownTitle, undefined); checks++;
    const second = f.key('second'); await action.onWillAppear({ action: second });
    control.message({ type: 'state', disabled: true }); await flush();
    assert.equal(first.shownState, 1); assert.equal(second.shownState, 1); checks++;

    const diagnostic = f.servers[0].connect();
    diagnostic.message({ type: 'hello', role: 'diagnostic', protocolVersion: 1 });
    diagnostic.message({ type: 'state', disabled: false });
    assert.equal(b.getState().disabled, true);
    diagnostic.terminate(); assert.equal(b.getState().connected, true); checks++;
    const standby = f.servers[0].connect(); standby.message({ type: 'state', disabled: false });
    assert.equal(b.getState().disabled, true); checks++;
    const before = control.packets.filter(p => p.type === 'toggle').length;
    await action.onKeyDown({ action: first }); await action.onKeyDown({ action: second });
    assert.equal(b.getState().busy, true);
    assert.equal(control.packets.filter(p => p.type === 'toggle').length, before + 1);
    assert.equal(standby.packets.filter(p => p.type === 'toggle').length, 0);
    assert.equal(first.shownState, 1); assert.equal(second.alerts, 0); checks++;
    control.message({ type: 'state', disabled: true }); assert.equal(b.getState().busy, true); checks++;
    control.message({ type: 'state', disabled: false }); await flush();
    assert.equal(b.getState().busy, false); assert.equal(first.shownState, 0); assert.equal(second.shownState, 0); checks++;
    assert.equal(b.toggle(), true); await f.tick(1500);
    assert.equal(control.packets.filter(p => p.type === 'toggle').length, before + 2);
    assert.equal(b.getState().busy, false); checks++;
    control.message({ type: 'state', disabled: true });
    assert.equal(b.getState().disabled, false, 'A standby must not steal the active target'); checks++;
    standby.terminate(); assert.equal(b.getState().disabled, true); checks++;
    control.autoPong = false; await f.tick(2000); await f.tick(2000);
    assert.equal(b.getState().connected, false); await flush();
    assert.equal(first.shownImage, 'imgs/disconnected.svg'); assert.equal(control.terminated, 1); checks++;

    const silent = f.servers[0].connect(); await f.tick(6000);
    assert.equal(silent.terminated, 1); assert.equal(b.getState().connected, false); checks++;
    const legacy = f.servers[0].connect(); legacy.message({ type: 'state', disabled: true });
    await f.tick(2000);
    assert.equal(legacy.packets.at(-1).type, 'getState');
    legacy.message({ type: 'state', disabled: true }); assert.equal(b.getState().connected, true); checks++;
    const protectedState = b.getState(); protectedState.disabled = false;
    assert.equal(b.getState().disabled, true); checks++;
    legacy.sendError = true; assert.equal(b.toggle(), false);
    assert.equal(b.getState().connected, false); assert.equal(b.getState().busy, false); checks++;
    f.servers[0].emit('error', new Error('EADDRINUSE'));
    await f.tick(1999); assert.equal(f.servers.length, 1);
    await f.tick(1); assert.equal(f.servers.length, 2); checks++;
    const restored = f.servers[1].connect(); restored.message({ type: 'state', disabled: false }); await flush();
    assert.equal(first.shownImage, undefined); assert.equal(first.shownState, 0); checks++;
    f.servers[0].emit('close'); assert.equal(b.getState().connected, true); checks++;
    restored.message('bad-json'); assert.equal(b.getState().connected, true); checks++;

    // Serialize per-key writes; a deferred old render must not win over new state.
    const delayed = f.key('delayed'); let finish;
    delayed.setState = function (value) {
        this.setState = async next => { this.shownState = next; };
        return new Promise(done => { finish = () => { this.shownState = value; done(); }; });
    };
    const painting = action.onWillAppear({ action: delayed });
    restored.message({ type: 'state', disabled: true }); finish(); await painting; await flush();
    assert.equal(delayed.shownState, 1); assert.equal(delayed.shownImage, undefined); checks++;
    const oldKey = f.key('reappear'); let finishOld;
    oldKey.setState = value => new Promise(done => { finishOld = () => { oldKey.shownState = value; done(); }; });
    const oldPainting = action.onWillAppear({ action: oldKey });
    action.onWillDisappear({ action: oldKey }); const newKey = f.key('reappear');
    const newPainting = action.onWillAppear({ action: newKey }); finishOld();
    await oldPainting; await newPainting; await flush();
    assert.equal(newKey.shownState, 1); assert.equal(oldKey.shownImage, null); checks++;
    const flaky = f.key('flaky'); let failed = false;
    flaky.setImage = async function (value) { if (!failed) { failed = true; throw new Error('Display failure'); } this.shownImage = value; };
    await action.onWillAppear({ action: flaky }); await f.tick(1000);
    assert.equal(flaky.shownImage, undefined); checks++;
    action.onWillDisappear({ action: flaky }); const images = flaky.history.length;
    restored.message({ type: 'state', disabled: false }); await f.tick(2000);
    assert.equal(flaky.history.length, images); checks++;
    b.stopBridge(); const serverCount = f.servers.length; await f.tick(10000);
    assert.equal(f.servers.length, serverCount); assert.equal(b.getState().connected, false); checks++;

    // Exercise the actual Vencord module and companion together without opening
    // the production port or interacting with a live Discord/Stream Deck app.
    const integrated = fixture(), r = createRuntime(vencordCode, { socketConnecting: true }); await r.start();
    function link(browser) {
        const remote = integrated.servers[0].connect();
        const buffered = remote.packets.slice();
        const originalSend = browser.send.bind(browser), originalClose = browser.close.bind(browser);
        browser.send = value => { originalSend(value); remote.message(value); };
        browser.close = () => { originalClose(); remote.terminate(); };
        remote.send = (value, callback) => { remote.packets.push(JSON.parse(value)); browser.onmessage?.({ data: value }); callback?.(); };
        browser.readyState = 1; browser.onopen();
        for (const packet of buffered) browser.onmessage?.({ data: JSON.stringify(packet) });
        return remote;
    }
    const mainRemote = link(r.sockets[0]);
    assert.equal(integrated.bridge.getState().connected, true);
    assert.equal(integrated.bridge.getState().disabled, false); checks++;
    const physical = new integrated.Action(), key = integrated.key('physical');
    await physical.onWillAppear({ action: key }); await physical.onKeyDown({ action: key }); await flush();
    assert.equal(integrated.bridge.getState().disabled, true); assert.equal(key.shownState, 1); checks++;
    r.toggle(); await flush();
    assert.equal(integrated.bridge.getState().disabled, false); assert.equal(key.shownState, 0); checks++;
    r.testApi.checkStreamDeckConnection(); link(r.sockets.at(-1)); await flush();
    assert.equal(r.testApi.getStreamDeckDiagnostics().result, 'ok');
    assert.equal(integrated.bridge.getState().connected, true);
    assert.equal(key.shownState, 0);
    assert.equal(mainRemote.packets.filter(p => p.type === 'toggle').length, 1); checks++;
    r.settings().streamDeckEnabled = false; await flush();
    assert.equal(integrated.bridge.getState().connected, false); assert.equal(key.shownImage, 'imgs/disconnected.svg'); checks++;
    r.settings().streamDeckEnabled = true; link(r.sockets.at(-1)); await flush();
    assert.equal(integrated.bridge.getState().connected, true); assert.equal(key.shownImage, undefined); checks++;
    r.unmount(); r.plugin.stop(); integrated.bridge.stopBridge();
    console.log(`${checks} companion bridge/button/integration checks: PASS`);
    return checks;
}
module.exports = main;
