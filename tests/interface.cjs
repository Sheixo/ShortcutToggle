const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createRuntime } = require('./runtime.cjs');
let checks = 0;
function elements(tree, predicate) {
    const found = [];
    const walk = item => {
        if (!item || typeof item !== 'object') return;
        if (Array.isArray(item)) return item.forEach(walk);
        if (predicate(item)) found.push(item);
        walk(item.props?.children);
    };
    walk(tree); return found;
}
function text(tree) {
    if (tree == null || tree === false) return '';
    if (Array.isArray(tree)) return tree.map(text).join(' ');
    if (typeof tree !== 'object') return String(tree);
    return text(tree.props?.children);
}
function button(tree, label) { return elements(tree, el => el.type === 'button' && text(el).includes(label))[0]; }
async function main(code) {
    const fresh = createRuntime(code, { fresh: true });
    await fresh.start();
    assert.equal(fresh.settings().streamDeckEnabled, false); assert.equal(fresh.sockets.length, 0);
    assert.equal(fresh.testApi.getStreamDeckStatus(), 'disabled');
    fresh.toggle(); assert.equal(text(fresh.render(fresh.testApi.ShortcutStatus)).includes('OFF'), true);
    fresh.plugin.stop(); checks++;

    const r = createRuntime(code);
    await r.start(); const api = r.testApi;
    assert.equal(r.settings().streamDeckEnabled, true); assert.equal(r.sockets.length, 1); checks++;
    const root = r.render(api.ShortcutSettings);
    assert.equal(elements(root, el => typeof el.type === 'function').length, 4); checks++;
    let status = r.render(api.ShortcutStatus); assert.match(text(status), /ON/);
    button(status, 'Désactiver').props.onClick();
    status = r.render(api.ShortcutStatus); assert.match(text(status), /OFF/); checks++;

    const all = Object.values(r.state);
    assert.equal(api.filterKeybinds(all, 'micro').length, 1);
    assert.equal(api.filterKeybinds(all, 'appuyer parler').length, 1);
    assert.equal(api.filterKeybinds(all, 'g').some(k => k.id === 1), true);
    assert.equal(api.filterKeybinds(all, 'désactiver MICRO').length, 1); checks++;

    let list = r.render(api.KeybindSelector);
    button(list, 'Tout sélectionner').props.onClick();
    assert.deepEqual(new Set(r.settings().selectedKeybindIds), new Set(['1', '2', '3']));
    assert.equal(r.state[3].enabled, false);
    const count = r.calls.length; r.press(1); r.press(2); assert.equal(r.calls.length, count); checks++;
    list = r.render(api.KeybindSelector); button(list, 'Tout désélectionner').props.onClick();
    r.press(1); assert.equal(r.calls.length, count + 2);
    assert.deepEqual(Array.from(r.settings().selectedKeybindIds), []); assert.equal(r.latestState(), true); checks++;

    list = r.render(api.KeybindSelector);
    elements(list, el => el.type === 'input')[0].props.onChange({ currentTarget: { value: 'micro' } });
    list = r.render(api.KeybindSelector);
    assert.match(text(list), /Sélectionner les résultats/);
    button(list, 'Sélectionner les résultats').props.onClick();
    assert.deepEqual(Array.from(r.settings().selectedKeybindIds), ['2']);
    assert.equal(elements(list, el => typeof el.type === 'function' && el.type.name === 'Checkbox').length, 1); checks++;
    button(r.render(api.KeybindSelector), 'Désélectionner les résultats').props.onClick();
    assert.deepEqual(Array.from(r.settings().selectedKeybindIds), []); checks++;
    elements(r.render(api.KeybindSelector), el => el.type === 'input')[0].props.onChange({ currentTarget: { value: 'aucun-resultat' } });
    list = r.render(api.KeybindSelector);
    assert.match(text(list), /Aucun résultat/); assert.equal(button(list, 'Sélectionner les résultats').props.disabled, true); checks++;

    let deck = r.render(api.StreamDeckSettings);
    r.sockets[0].onopen(); deck = r.render(api.StreamDeckSettings); assert.match(text(deck), /Connecté/); checks++;
    const oldSocket = r.sockets[0], oldMessage = oldSocket.onmessage, oldOpen = oldSocket.onopen, oldClose = oldSocket.onclose;
    elements(deck, el => typeof el.type === 'function' && el.type.name === 'Checkbox')[0].props.onChange();
    assert.equal(r.settings().streamDeckEnabled, false); assert.equal(api.getStreamDeckStatus(), 'disabled');
    await r.tick(3000); assert.equal(r.sockets.length, 1); checks++;
    const previousState = r.latestState(); oldMessage({ data: '{"type":"toggle"}' }); oldOpen(); oldClose();
    assert.equal(r.latestState(), previousState); assert.equal(api.getStreamDeckStatus(), 'disabled'); checks++;

    r.settings().streamDeckEnabled = true; assert.equal(r.sockets.length, 2);
    const current = r.sockets[1]; current.onopen(); assert.equal(api.getStreamDeckStatus(), 'connected'); checks++;
    current.onclose(); assert.equal(api.getStreamDeckStatus(), 'disconnected');
    await r.tick(1999); assert.equal(r.sockets.length, 2);
    await r.tick(1); assert.equal(r.sockets.length, 3); checks++;
    r.sockets[2].onopen(); const lastMsg = r.sockets[2].onmessage;
    api.reconnectStreamDeck(); assert.equal(r.sockets.length, 4);
    lastMsg({ data: '{"type":"toggle"}' }); assert.equal(r.latestState(), undefined);
    r.sockets[3].onopen(); assert.equal(r.latestState(), true); checks++;

    r.unmount(); r.plugin.stop(); await r.tick(4000);
    assert.equal(api.getStreamDeckStatus(), 'disabled'); assert.equal(r.listeners.size, 0); assert.equal(r.sockets.length, 4); checks++;
    r.plugin.start(); await r.tick(500); assert.equal(r.settings().streamDeckEnabled, true); r.plugin.stop(); checks++;

    const existingDisabled = createRuntime(code, { preference: false }); await existingDisabled.start();
    assert.equal(existingDisabled.sockets.length, 0); existingDisabled.plugin.stop(); checks++;
    const freshOn = createRuntime(code, { fresh: true, preference: true }); await freshOn.start();
    assert.equal(freshOn.sockets.length, 1); freshOn.plugin.stop(); checks++;
    assert.deepEqual(r.errors, []);
    console.log(`${checks} public interface/integration checks: PASS`);
    return checks;
}
module.exports = main;
