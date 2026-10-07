const assert = require('node:assert/strict');
const { createRuntime } = require('./runtime.cjs');
function text(tree) {
    if (tree == null || tree === false) return '';
    if (Array.isArray(tree)) return tree.map(text).join(' ');
    return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function buttons(tree) {
    const result = [];
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (node.type === 'button') result.push(node);
        walk(node.props?.children);
    }
    walk(tree); return result;
}
const button = (r, label) => buttons(r.render(r.testApi.StreamDeckSettings)).find(b => text(b).includes(label));
const open = socket => { socket.readyState = 1; socket.onopen?.(); };
const message = (socket, value) => socket.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) });
async function main(code) {
    let checks = 0;
    const disabled = createRuntime(code, { fresh: true }); await disabled.start();
    disabled.testApi.checkStreamDeckConnection();
    assert.equal(disabled.sockets.length, 0);
    assert.equal(disabled.testApi.getStreamDeckDiagnostics().result, 'idle');
    assert.equal(button(disabled, 'Vérifier'), undefined);
    disabled.unmount(); disabled.plugin.stop(); checks++;

    const r = createRuntime(code, { socketConnecting: true }); await r.start();
    const api = r.testApi, mainSocket = r.sockets[0];
    assert.equal(api.getStreamDeckStatus(), 'connecting');
    assert.equal(api.getStreamDeckDiagnostics().attempts, 1); checks++;
    open(mainSocket); message(mainSocket, { type: 'getState' });
    assert.equal(api.getStreamDeckStatus(), 'connected');
    assert.equal(api.getStreamDeckDiagnostics().lastConnectedAt, 500);
    assert.equal(api.getStreamDeckDiagnostics().lastMessageAt, 500);
    assert.equal(mainSocket.messages.at(-1).disabled, false); checks++;

    r.toggle(); assert.match(text(r.render(api.ShortcutStatus)), /OFF/);
    const selection = Array.from(r.settings().selectedKeybindIds), writes = r.writes.length, calls = r.calls.length;
    button(r, 'Vérifier').props.onClick();
    const probe = r.sockets[1];
    assert.equal(api.getStreamDeckDiagnostics().result, 'checking');
    assert.equal(button(r, 'Vérification').props.disabled, true);
    api.checkStreamDeckConnection(); assert.equal(r.sockets.length, 2);
    assert.equal(mainSocket.readyState, 1); checks++;

    open(probe); message(probe, { type: 'toggle' });
    assert.equal(api.getStreamDeckDiagnostics().result, 'checking');
    assert.match(text(r.render(api.ShortcutStatus)), /OFF/);
    assert.equal(r.calls.length, calls); checks++;
    message(probe, { type: 'getState' });
    assert.equal(api.getStreamDeckDiagnostics().result, 'ok');
    assert.equal(probe.readyState, 3);
    assert.deepEqual(probe.messages.map(m => m.type), ['state']);
    assert.equal(probe.messages[0].disabled, true);
    assert.equal(r.writes.length, writes);
    assert.deepEqual(Array.from(r.settings().selectedKeybindIds), selection);
    assert.match(text(r.render(api.ShortcutStatus)), /OFF/);
    assert.match(text(r.render(api.StreamDeckSettings)), /répond correctement.*Dernière vérification/); checks++;

    const snapshot = api.getStreamDeckDiagnostics(); snapshot.result = 'unavailable';
    assert.equal(api.getStreamDeckDiagnostics().result, 'ok');
    await r.tick(6000); assert.equal(api.getStreamDeckDiagnostics().result, 'ok');
    assert.equal(r.sockets.length, 2); assert.equal(mainSocket.readyState, 1); checks++;

    // Expected reply, transport availability and sends each have distinct results.
    for (const [mode, expected] of [
        ['neverOpen', 'unavailable'], ['silent', 'noResponse'], ['malformed', 'noResponse'],
        ['unknown', 'noResponse'], ['errorBeforeOpen', 'unavailable'], ['errorAfterOpen', 'interrupted'],
        ['closeAfterOpen', 'noResponse'], ['closeBeforeOpen', 'unavailable'], ['sendError', 'sendFailed']
    ]) {
        api.checkStreamDeckConnection(); const current = r.sockets.at(-1);
        if (!['neverOpen', 'errorBeforeOpen', 'closeBeforeOpen'].includes(mode)) open(current);
        if (mode === 'malformed') message(current, 'bad-json');
        if (mode === 'unknown') message(current, { type: 'hello' });
        if (mode.startsWith('error')) current.onerror();
        if (mode.startsWith('close')) current.close();
        if (mode === 'sendError') { current.send = () => { throw new Error('Simulated send failure'); }; message(current, { type: 'getState' }); }
        await r.tick(5000);
        assert.equal(api.getStreamDeckDiagnostics().result, expected, mode);
        assert.equal(current.readyState, 3);
        assert.match(text(r.render(api.StreamDeckSettings)), /À vérifier/);
        assert.equal(mainSocket.readyState, 1);
        assert.match(text(r.render(api.ShortcutStatus)), /OFF/); checks++;
    }
    r.failNextSocket(); api.checkStreamDeckConnection();
    assert.equal(api.getStreamDeckDiagnostics().result, 'unavailable');
    await r.tick(5000); assert.equal(api.getStreamDeckDiagnostics().result, 'unavailable'); checks++;

    api.checkStreamDeckConnection(); const finished = r.sockets.at(-1);
    open(finished); const staleMessage = finished.onmessage, staleError = finished.onerror;
    message(finished, { type: 'getState' }); api.checkStreamDeckConnection();
    staleMessage({ data: '{"type":"getState"}' }); staleError();
    assert.equal(api.getStreamDeckDiagnostics().result, 'checking'); checks++;

    const canceled = r.sockets.at(-1), canceledReply = canceled.onmessage;
    r.settings().streamDeckEnabled = false;
    assert.equal(canceled.readyState, 3); assert.equal(mainSocket.readyState, 3);
    assert.equal(api.getStreamDeckDiagnostics().result, 'idle');
    const count = r.sockets.length; await r.tick(10000); assert.equal(r.sockets.length, count);
    r.settings().streamDeckEnabled = true;
    canceledReply({ data: '{"type":"getState"}' });
    assert.equal(api.getStreamDeckDiagnostics().result, 'idle');
    assert.equal(api.getStreamDeckDiagnostics().attempts, 1); checks++;

    open(r.sockets.at(-1)); api.checkStreamDeckConnection();
    const stopped = r.sockets.at(-1), stoppedReply = stopped.onmessage;
    r.unmount(); r.plugin.stop(); await r.start();
    stoppedReply({ data: '{"type":"getState"}' });
    assert.equal(stopped.readyState, 3);
    assert.equal(api.getStreamDeckDiagnostics().result, 'idle');
    assert.match(text(r.render(api.ShortcutStatus)), /ON/); checks++;
    assert.ok(r.sockets.every(s => s.url === 'ws://127.0.0.1:45873'));
    r.unmount(); r.plugin.stop(); checks++;

    // A stalled background connection must eventually release its slot and retry.
    const stalled = createRuntime(code, { socketConnecting: true }); await stalled.start();
    const old = stalled.sockets[0], oldOpen = old.onopen, oldMessage = old.onmessage;
    await stalled.tick(4500);
    assert.equal(stalled.testApi.getStreamDeckStatus(), 'disconnected');
    assert.equal(old.readyState, 3);
    assert.match(text(stalled.render(stalled.testApi.StreamDeckSettings)), /À vérifier/); checks++;
    await stalled.tick(1999); assert.equal(stalled.sockets.length, 1);
    await stalled.tick(1); assert.equal(stalled.sockets.length, 2);
    assert.equal(stalled.testApi.getStreamDeckDiagnostics().attempts, 2);
    oldOpen(); oldMessage({ data: '{"type":"toggle"}' });
    assert.equal(stalled.testApi.getStreamDeckStatus(), 'connecting'); checks++;
    open(stalled.sockets[1]); await stalled.tick(6000);
    assert.equal(stalled.testApi.getStreamDeckStatus(), 'connected');
    assert.equal(stalled.sockets.length, 2); checks++;

    const bad = stalled.sockets[1]; bad.close = () => { throw new Error('Simulated close failure'); };
    bad.onerror(); await stalled.tick(2000);
    assert.equal(stalled.sockets.length, 3);
    assert.equal(stalled.testApi.getStreamDeckStatus(), 'connecting'); checks++;
    open(stalled.sockets[2]); message(stalled.sockets[2], { type: 'getState' });
    const before = stalled.writes.length;
    stalled.testApi.checkStreamDeckConnection(); const probe2 = stalled.sockets.at(-1);
    open(probe2); stalled.sockets[2].close();
    message(probe2, { type: 'getState' });
    assert.equal(stalled.testApi.getStreamDeckDiagnostics().result, 'ok');
    assert.equal(stalled.testApi.getStreamDeckStatus(), 'disconnected');
    assert.match(text(stalled.render(stalled.testApi.StreamDeckSettings)), /compagnon est disponible.*Reconnecter/);
    assert.equal(stalled.writes.length, before); checks++;
    stalled.unmount(); stalled.plugin.stop();
    assert.deepEqual(r.errors, []); assert.deepEqual(stalled.errors, []);
    console.log(`${checks} Stream Deck diagnostic/lifecycle checks: PASS`);
    return checks;
}
module.exports = main;
