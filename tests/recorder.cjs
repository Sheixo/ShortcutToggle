const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createRuntime } = require('./runtime.cjs');
const TOGGLE_ID = 1396921420;
let checks = 0;

function key(r, type, code, value, extra = {}) {
    const event = {
        code, key: value, keyCode: value?.length === 1 ? value.toUpperCase().charCodeAt(0) : 0,
        location: code.endsWith('Right') ? 2 : 0,
        ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false, isComposing: false,
        prevented: false, stopped: false,
        preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra
    };
    r.document.emit(type, event);
    return event;
}
function chord(r, code, value, extra = {}) {
    key(r, 'keydown', code, value, extra);
    key(r, 'keyup', code, value, extra);
}

async function main(code) {
    const r = createRuntime(code);
    await r.start();
    const recorder = r.recorder;
    assert.equal(r.definition().toggleShortcut.hidden, true);
    assert.equal(r.definition().pluginSettings.type, 4);
    checks++;

    const owner = Symbol('settings');
    recorder.startShortcutRecording(owner);
    assert.equal(r.document.count(), 3); assert.equal(r.window.count(), 1);
    assert.equal(recorder.getView().recording, true);
    const originalState = r.latestState(), originalCalls = r.calls.length;
    r.press(1); r.press(2); r.press(TOGGLE_ID);
    assert.equal(r.calls.length, originalCalls); assert.equal(r.latestState(), originalState); checks++;
    const f13Down = key(r, 'keydown', 'F13', 'F13');
    assert.equal(f13Down.prevented, true); assert.equal(f13Down.stopped, true);
    assert.equal(recorder.getView().preview, 'F13'); assert.equal(recorder.getView().recording, true);
    key(r, 'keyup', 'F13', 'F13');
    assert.equal(recorder.getView().recording, false); assert.equal(r.settings().toggleShortcut, 'F13');
    assert.equal(r.document.count(), 0); assert.equal(r.window.count(), 0);
    r.press(TOGGLE_ID); assert.equal(r.latestState(), originalState); checks++;
    await r.tick(250); r.toggle(); assert.equal(r.latestState(), true); checks++;

    // Preserve OFF and the selected/unselected Discord bindings throughout capture.
    recorder.startShortcutRecording(owner);
    key(r, 'keydown', 'ControlLeft', 'Control', { ctrlKey: true });
    key(r, 'keydown', 'ShiftLeft', 'Shift', { ctrlKey: true, shiftKey: true });
    key(r, 'keydown', 'KeyK', 'K', { ctrlKey: true, shiftKey: true });
    assert.equal(recorder.getView().preview, 'CTRL + SHIFT + K');
    key(r, 'keyup', 'KeyK', 'K', { ctrlKey: true, shiftKey: true });
    assert.equal(r.settings().toggleShortcut, 'F13', 'Saved before modifiers were released');
    key(r, 'keyup', 'ShiftLeft', 'Shift', { ctrlKey: true });
    assert.equal(recorder.getView().recording, true);
    key(r, 'keyup', 'ControlLeft', 'Control');
    assert.equal(r.settings().toggleShortcut, 'CTRL+SHIFT+K');
    assert.deepEqual(r.entries.get(TOGGLE_ID).shortcut, [[0, 162], [0, 160], [0, 75]]);
    assert.equal(r.latestState(), true); checks++;
    await r.tick(250); const offCount = r.calls.length; r.press(1); assert.equal(r.calls.length, offCount);
    r.press(2); assert.equal(r.calls.length, offCount + 2); checks++;

    // Escape cancels even after a complete main key has been pressed with modifiers.
    recorder.startShortcutRecording(owner);
    key(r, 'keydown', 'KeyL', 'l', { ctrlKey: true });
    const esc = key(r, 'keydown', 'Escape', 'Escape', { ctrlKey: true });
    assert.equal(esc.prevented, true); assert.equal(recorder.getView().recording, false);
    assert.equal(r.settings().toggleShortcut, 'CTRL+SHIFT+K'); assert.equal(r.document.count(), 0); checks++;

    recorder.startShortcutRecording(owner);
    key(r, 'keydown', 'ControlRight', 'Control', { ctrlKey: true });
    key(r, 'keyup', 'ControlRight', 'Control');
    assert.equal(recorder.getView().recording, true); assert.ok(recorder.getView().error);
    assert.equal(r.settings().toggleShortcut, 'CTRL+SHIFT+K');
    chord(r, 'F14', 'F14'); assert.equal(r.settings().toggleShortcut, 'F14'); checks++;

    recorder.startShortcutRecording(owner);
    chord(r, 'Semicolon', ';'); assert.equal(recorder.getView().recording, true);
    assert.ok(recorder.getView().error); assert.equal(r.settings().toggleShortcut, 'F14');
    chord(r, 'F15', 'F15'); assert.equal(r.settings().toggleShortcut, 'F15'); checks++;

    recorder.startShortcutRecording(owner);
    key(r, 'keydown', 'KeyK', 'k'); key(r, 'keydown', 'KeyL', 'l');
    key(r, 'keyup', 'KeyL', 'l'); key(r, 'keyup', 'KeyK', 'k');
    assert.equal(r.settings().toggleShortcut, 'F15'); assert.equal(recorder.getView().recording, true);
    chord(r, 'F16', 'F16'); assert.equal(r.settings().toggleShortcut, 'F16'); checks++;

    recorder.startShortcutRecording(owner);
    key(r, 'keydown', 'ControlRight', 'Control', { ctrlKey: true });
    key(r, 'keydown', 'KeyK', 'k', { ctrlKey: true });
    key(r, 'keydown', 'KeyK', 'k', { ctrlKey: true, repeat: true });
    key(r, 'keyup', 'ControlRight', 'Control');
    key(r, 'keyup', 'KeyK', 'k');
    assert.equal(r.settings().toggleShortcut, 'RCTRL+K');
    assert.deepEqual(r.entries.get(TOGGLE_ID).shortcut, [[0, 163], [0, 75]]); checks++;

    // Modifiers held before clicking, and layout-dependent letters (AZERTY).
    recorder.startShortcutRecording(owner); chord(r, 'KeyQ', 'a', { ctrlKey: true });
    assert.equal(recorder.getView().recording, true); key(r, 'keyup', 'ControlLeft', 'Control');
    assert.equal(r.settings().toggleShortcut, 'CTRL+A'); checks++;
    recorder.startShortcutRecording(owner); chord(r, 'Digit1', '&');
    assert.equal(r.settings().toggleShortcut, '1'); checks++;
    recorder.startShortcutRecording(owner); chord(r, 'Numpad1', '1');
    assert.equal(r.settings().toggleShortcut, 'NUMPAD1');
    assert.deepEqual(r.entries.get(TOGGLE_ID).shortcut, [[0, 97]]); checks++;
    recorder.startShortcutRecording(owner); chord(r, 'Numpad1', 'End');
    assert.equal(r.settings().toggleShortcut, 'END'); checks++;

    recorder.startShortcutRecording(owner); key(r, 'keydown', 'KeyL', 'l');
    r.window.emit('blur'); assert.equal(recorder.getView().recording, false);
    assert.equal(r.settings().toggleShortcut, 'END'); assert.equal(r.document.count(), 0); checks++;
    recorder.startShortcutRecording(owner); r.document.hidden = true; r.document.emit('visibilitychange');
    assert.equal(recorder.getView().recording, false); r.document.hidden = false; checks++;
    recorder.startShortcutRecording(owner); recorder.cancelShortcutRecording(Symbol('other'));
    assert.equal(recorder.getView().recording, true); recorder.cancelShortcutRecording(owner);
    assert.equal(recorder.getView().recording, false); checks++;

    // Reset is immediate and cancels an in-progress capture.
    recorder.startShortcutRecording(owner); key(r, 'keydown', 'KeyL', 'l'); recorder.resetToggleShortcut();
    assert.equal(r.settings().toggleShortcut, 'F13'); assert.equal(recorder.getView().recording, false);
    assert.equal(r.document.count(), 0); assert.deepEqual(r.entries.get(TOGGLE_ID).shortcut, [[0, 124]]);
    assert.equal(r.latestState(), true); checks++;

    r.failNextToggleRegister(); recorder.startShortcutRecording(owner); chord(r, 'F14', 'F14');
    assert.equal(r.settings().toggleShortcut, 'F13'); assert.ok(recorder.getView().error);
    assert.deepEqual(r.entries.get(TOGGLE_ID).shortcut, [[0, 124]]);
    assert.equal(r.settings().lastValidToggleShortcut, 'F13'); checks++;

    await r.tick(250); r.toggle(); assert.equal(r.latestState(), false);
    r.fire(1, true); const heldCount = r.calls.length;
    recorder.startShortcutRecording(owner); assert.equal(r.calls.length, heldCount + 1);
    assert.equal(r.calls.at(-1).down, false); recorder.cancelShortcutRecording(owner); r.fire(1, false);
    assert.equal(r.calls.length, heldCount + 1); checks++;

    // A long native press made while recording stays ignored after cancellation.
    recorder.startShortcutRecording(owner); r.fire(TOGGLE_ID, true);
    recorder.cancelShortcutRecording(owner); await r.tick(500); r.fire(TOGGLE_ID, true);
    assert.equal(r.latestState(), false); r.fire(TOGGLE_ID, false); r.toggle(); assert.equal(r.latestState(), true); checks++;

    recorder.startShortcutRecording(owner);
    r.sockets.at(-1).onmessage({ data: JSON.stringify({ type: 'toggle' }) });
    assert.equal(r.latestState(), false); chord(r, 'F17', 'F17'); assert.equal(r.latestState(), false); checks++;
    recorder.startShortcutRecording(owner); r.plugin.stop();
    assert.equal(r.document.count(), 0); assert.equal(r.window.count(), 0); assert.equal(recorder.getView().recording, false);
    chord(r, 'F18', 'F18'); assert.equal(r.settings().toggleShortcut, 'F17'); checks++;
    assert.ok(r.errors.every(error => error.includes('Simulated native registration failure')), r.errors.join('\n'));

    console.log(`${checks} recorder behavioral checks: PASS`);
    return checks;
}
module.exports = main;
