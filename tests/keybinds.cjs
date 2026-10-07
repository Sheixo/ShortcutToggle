const assert = require('node:assert/strict');
const { createRuntime } = require('./runtime.cjs');
async function main(code) {
const result = {code};
    let scenarios = 0;
    for (const order of ['storeFirst', 'registerFirst']) {
        const r = createRuntime(result.code, { order });
        await r.start();
        assert.equal(r.definition().toggleShortcut.default, 'F13');
        assert.deepEqual(r.entries.get(1396921420).shortcut, [[0, 124]]);
        assert.equal(r.latestState(), false);
        r.press(1); assert.equal(r.calls.filter(c => c.id === 1 && c.down).length, 1); scenarios++;

        r.toggle(); assert.equal(r.latestState(), true);
        const count = r.calls.length;
        r.press(1); assert.equal(r.calls.length, count);
        r.press(2); assert.equal(r.calls.at(-2).id, 2); scenarios++;

        r.put({ id: 4, shortcut: [[0, 72]], action: 'PUSH_TO_MUTE', enabled: true, managed: false });
        const freshCount = r.calls.length;
        r.press(4); assert.equal(r.calls.length, freshCount, 'New key leaked before reconciliation while OFF');
        await r.tick(); assert.ok(r.settings().selectedKeybindIds.includes('4'));
        r.press(4); assert.equal(r.calls.length, freshCount); assert.equal(r.latestState(), true); scenarios++;

        r.settings().selectedKeybindIds = r.settings().selectedKeybindIds.filter(id => id !== '4');
        r.press(4); assert.equal(r.calls.at(-2).id, 4);
        await r.tick(); r.patch(4, { shortcut: [[0, 74]] }); await r.tick();
        assert.ok(!r.settings().selectedKeybindIds.includes('4'), 'Editing an unchecked key reselected it');
        r.press(4); assert.deepEqual(r.calls.at(-2).shortcut, [[0, 74]]); scenarios++;

        r.settings().selectedKeybindIds = [...r.settings().selectedKeybindIds, '2'];
        const selectCount = r.calls.length;
        r.press(2); assert.equal(r.calls.length, selectCount, 'Existing key selection was not immediate'); scenarios++;

        const stale = r.entries.get(1).callback;
        r.patch(1, { shortcut: [[0, 90]], action: 'PUSH_TO_TALK' });
        r.press(1); assert.equal(r.calls.length, selectCount);
        r.toggle(); r.toggle(); r.toggle(); // Last requested state is ON, including an update in progress.
        await r.tick(); assert.equal(r.latestState(), false);
        r.press(1); assert.equal(r.calls.at(-2).action, 'PUSH_TO_TALK'); assert.deepEqual(r.calls.at(-2).shortcut, [[0, 90]]);
        const staleCount = r.calls.length;
        stale(true); stale(false); assert.equal(r.calls.length, staleCount, 'Obsolete callback fired'); scenarios++;

        r.put({ id: 5, shortcut: [[0, 75]], action: 'TOGGLE_DEAFEN', enabled: true, managed: false });
        await r.tick(); assert.ok(r.settings().selectedKeybindIds.includes('5'));
        r.press(5); assert.equal(r.calls.at(-2).id, 5);
        r.toggle(); const onNewCount = r.calls.length; r.press(5); assert.equal(r.calls.length, onNewCount); scenarios++;

        r.remove(1); await r.tick(); assert.ok(!r.settings().selectedKeybindIds.includes('1'));
        r.toggle(); assert.ok(!r.entries.has(1), 'Deleted native key was restored on ON'); scenarios++;

        r.settings().selectedKeybindIds = [...r.settings().selectedKeybindIds, '3'];
        await r.tick(); assert.equal(r.state[3].enabled, false); assert.ok(!r.entries.has(3));
        assert.ok(!r.writes.some(w => w.id === 3 && w.enabled)); scenarios++;

        r.patch(5, { enabled: false }); await r.tick(); r.toggle(); r.toggle();
        assert.ok(!r.entries.has(5)); assert.equal(r.state[5].enabled, false); scenarios++;
        r.patch(5, { enabled: true }); await r.tick(); const reenabledCount = r.calls.length; r.press(5);
        assert.equal(r.calls.length, reenabledCount + 2, 'Reenabled key never executed'); assert.equal(r.calls.at(-2).id, 5); scenarios++;

        r.native.inputEventUnregister(2); await r.tick(); r.toggle(); r.toggle(); await r.tick();
        assert.ok(!r.entries.has(2), 'Discord external unregister was undone by toggle'); scenarios++;

        // Press held when turning OFF gets one release, and no phantom key-up action later.
        r.fire(5, true); const heldCount = r.calls.length; r.toggle();
        assert.equal(r.calls.length, heldCount + 1); assert.equal(r.calls.at(-1).down, false);
        r.fire(5, false); assert.equal(r.calls.length, heldCount + 1);
        r.fire(5, true); r.toggle(); r.fire(5, false); assert.equal(r.calls.length, heldCount + 1); scenarios++;

        // Changing/deleting a held key never dispatches its release inside Flux.
        r.fire(5, true); r.patch(5, { action: 'PUSH_TO_MUTE' }); await r.tick();
        assert.equal(r.calls.at(-1).down, false); scenarios++;

        r.put({ id: 6, shortcut: [], action: 'UNASSIGNED', enabled: true, managed: false }); await r.tick();
        assert.ok(r.settings().selectedKeybindIds.includes('6'));
        r.toggle(); r.patch(6, { shortcut: [[0, 76]], action: 'PUSH_TO_MUTE' }); await r.tick();
        const assignedCount = r.calls.length; r.press(6); assert.equal(r.calls.length, assignedCount); scenarios++;

        r.settings().toggleShortcut = 'CTRL+SHIFT+F13'; await r.tick(500);
        assert.deepEqual(r.entries.get(1396921420).shortcut, [[0, 162], [0, 160], [0, 124]]);
        r.settings().toggleShortcut = 'INVALID'; await r.tick(500);
        assert.deepEqual(r.entries.get(1396921420).shortcut, [[0, 162], [0, 160], [0, 124]]); scenarios++;

        const oldSocket = r.sockets[0]; oldSocket.onmessage({ data: JSON.stringify({ type: 'toggle' }) });
        assert.equal(r.latestState(), false);
        oldSocket.onmessage({ data: JSON.stringify({ type: 'getState' }) }); assert.equal(r.latestState(), false); scenarios++;
        oldSocket.onclose(); await r.tick(2000); r.sockets.at(-1).onopen();
        assert.equal(r.sockets.at(-1).messages.at(-1).disabled, false); scenarios++;

        r.plugin.stop(); assert.equal(r.native.inputEventRegister, r.originals.register);
        assert.equal(r.native.inputEventUnregister, r.originals.unregister); assert.equal(r.listeners.size, 0);
        assert.ok(!r.entries.has(1396921420)); assert.ok(!r.entries.has(1));
        const stoppedCount = r.calls.length; r.press(6); assert.equal(r.calls.length, stoppedCount + 2); scenarios++;
        r.plugin.start(); await r.tick(500); await r.tick(); assert.ok(r.entries.has(1396921420));
        r.plugin.stop(); scenarios++;
        assert.ok(r.errors.every(message => message.includes('Touche inconnue')), r.errors.join('\n'));
    }

    const r = createRuntime(result.code, { delay: true });
    await r.start(); r.toggle(); assert.equal(r.latestState(), true);
    r.put({ id: 7, shortcut: [[0, 77]], action: 'PUSH_TO_MUTE', enabled: true, managed: false });
    r.plugin.stop(); r.plugin.start(); await r.tick(500); r.releaseDeferred(); await r.tick();
    assert.equal(r.latestState(), false); assert.ok(r.entries.has(1396921420));
    r.plugin.stop(); scenarios++;
    console.log(`${scenarios} behavioral checks: PASS (both store/native notification orders, delayed capture, lifecycle, Stream Deck)`);
    return scenarios;
}

module.exports = main;
