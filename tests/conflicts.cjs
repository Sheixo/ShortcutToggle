const assert = require('node:assert/strict');
const { createRuntime } = require('./runtime.cjs');
const TOGGLE_ID = 1396921420;

function elements(tree, predicate) {
    const found = [];
    function walk(item) {
        if (!item || typeof item !== 'object') return;
        if (Array.isArray(item)) return item.forEach(walk);
        if (predicate(item)) found.push(item);
        walk(item.props?.children);
    }
    walk(tree); return found;
}
function text(tree) {
    if (tree == null || tree === false) return '';
    if (Array.isArray(tree)) return tree.map(text).join(' ');
    return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function warning(r) {
    const root = r.render(r.testApi.ShortcutRecorder);
    return elements(root, el => el.props?.['aria-label'] === 'Conflits du raccourci')[0];
}
function key(r, type, value) {
    r.document.emit(type, { code: value.length === 1 ? `Key${value}` : value, key: value,
        keyCode: value.length === 1 ? value.charCodeAt(0) : 0, location: 0,
        ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
        repeat: false, isComposing: false, preventDefault() {}, stopImmediatePropagation() {} });
}

async function main(code) {
    let checks = 0;
    const cases = [
        ['G', [[0, 71]], true],
        ['F13', [[0, 71]], false],
        ['CTRL+G', [[0, 71], [0, 162]], true],
        ['CONTROL+G', [[0, 162], [0, 71]], true],
        ['CTRL+G', [[0, 162], [0, 71], [0, 162]], true],
        ['CTRL+G', [[0, 71]], false],
        ['G', [[0, 162], [0, 71]], false],
        ['CTRL+G', [[0, 160], [0, 162], [0, 71]], false],
        ['RCTRL+G', [[0, 163], [0, 71]], true],
        ['CTRL+G', [[0, 163], [0, 71]], false],
        ['NUMPAD1', [[0, 49]], false],
        ['NUMPAD1', [[0, 97]], true],
        ['G', [[1, 71]], false],
        ['G', [['0', '71']], true],
        ['G', [[0, 71, 99]], false],
        ['G', [[0, 'bad']], false, { enabled: false }],
        ['G', [], false],
        ['G', null, false, { enabled: false }],
        ['G', [[null, 71]], false],
        ['G', [[0, 71]], false, { action: 'UNASSIGNED' }],
        ['G', [[0, 71]], true, { managed: true }],
        ['G', [[0, 71]], true, { enabled: false }]
    ];
    for (const [hotkey, shortcut, expected, extra = {}] of cases) {
        const r = createRuntime(code); await r.start();
        r.settings().toggleShortcut = hotkey; await r.tick(500);
        r.patch(1, { shortcut, ...extra }); await r.tick();
        assert.equal(elements(warning(r), el => el.type === 'li').length > 0, expected,
            `${hotkey} versus ${JSON.stringify(shortcut)} ${JSON.stringify(extra)}`);
        r.unmount(); r.plugin.stop(); checks++;
    }

    // Store notifications, missed notifications, ON/OFF and selection must all
    // refresh the visible warning without writing Discord settings to fix it.
    for (const order of ['storeFirst', 'registerFirst']) {
        for (const managed of [false, true]) {
            const r = createRuntime(code, { order }); await r.start();
            r.toggle(); warning(r);
            r.hookUpdates.length = 0;
            r.put({ id: 4, shortcut: [[0, 124]], action: 'TOGGLE_MUTE', enabled: true, managed });
            await r.tick();
            assert.ok(r.hookUpdates.includes('ShortcutRecorder'), 'Addition did not refresh the mounted recorder');
            assert.match(text(warning(r)), /Combinaison déjà utilisée.*Activer\/désactiver le micro/);
            assert.equal(r.latestState(), true); checks++;

            r.testApi.setKeybindSelection(['4'], false); await r.tick();
            const selection = Array.from(r.settings().selectedKeybindIds);
            const writes = r.writes.length;
            assert.match(text(warning(r)), /Activer\/désactiver le micro/);
            assert.equal(r.writes.length, writes); assert.equal(r.latestState(), true); checks++;

            r.hookUpdates.length = 0;
            r.patch(4, { action: 'TOGGLE_DEAFEN', enabled: false }); await r.tick();
            assert.ok(r.hookUpdates.includes('ShortcutRecorder'));
            assert.match(text(warning(r)), /Conflit possible.*Activer\/désactiver le son.*désactivé dans Discord/);
            assert.doesNotMatch(text(warning(r)), /Activer\/désactiver le micro/);
            assert.deepEqual(Array.from(r.settings().selectedKeybindIds), selection);
            assert.equal(r.latestState(), true); checks++;

            // Change the store directly to exercise the existing polling fallback.
            r.hookUpdates.length = 0;
            r.state[4].shortcut = [[0, 125]]; await r.tick(500);
            assert.ok(r.hookUpdates.includes('ShortcutRecorder'));
            assert.equal(text(warning(r)).trim(), ''); checks++;

            r.patch(4, { shortcut: [[0, 124]], enabled: true }); await r.tick();
            r.toggle(); assert.equal(r.latestState(), false);
            assert.match(text(warning(r)), /Activer\/désactiver le son/);
            const unchanged = r.writes.length; warning(r); warning(r);
            assert.equal(r.writes.length, unchanged);
            r.remove(4); await r.tick(); assert.equal(text(warning(r)).trim(), '');
            r.unmount(); r.plugin.stop(); checks++;
        }
    }

    const r = createRuntime(code); await r.start(); warning(r);
    r.settings().isFavorite = true;
    const originalSelection = Array.from(r.settings().selectedKeybindIds);
    r.toggle();
    const owner = Symbol('conflict recording');
    r.testApi.startShortcutRecording(owner); key(r, 'keydown', 'G');
    assert.equal(r.settings().toggleShortcut, 'F13');
    assert.match(text(warning(r)), /Appuyer-pour-rendre-muet/); checks++;
    key(r, 'keyup', 'G');
    assert.equal(r.settings().toggleShortcut, 'G');
    assert.match(text(warning(r)), /Appuyer-pour-rendre-muet/);
    assert.equal(r.latestState(), true);
    assert.equal(r.settings().isFavorite, true);
    assert.deepEqual(Array.from(r.settings().selectedKeybindIds), originalSelection); checks++;

    await r.tick(250); r.testApi.startShortcutRecording(owner); key(r, 'keydown', 'B');
    assert.match(text(warning(r)), /Activer\/désactiver le micro/);
    key(r, 'keydown', 'Escape');
    assert.equal(r.settings().toggleShortcut, 'G');
    assert.match(text(warning(r)), /Appuyer-pour-rendre-muet/); checks++;

    r.testApi.resetToggleShortcut(); assert.equal(text(warning(r)).trim(), '');
    r.failNextToggleRegister(); r.testApi.startShortcutRecording(owner);
    key(r, 'keydown', 'G'); key(r, 'keyup', 'G');
    assert.equal(r.settings().toggleShortcut, 'F13');
    assert.equal(text(warning(r)).trim(), '');
    assert.match(text(r.render(r.testApi.ShortcutRecorder)), /Impossible d'enregistrer/);
    assert.deepEqual(Array.from(r.entries.get(TOGGLE_ID).shortcut[0]), [0, 124]); checks++;

    r.put({ id: 4, shortcut: [[0, 124]], action: 'TOGGLE_MUTE', enabled: true, managed: false });
    r.put({ id: 5, shortcut: [[0, 124]], action: 'TOGGLE_DEAFEN', enabled: false, managed: false });
    await r.tick(); assert.equal(elements(warning(r), el => el.type === 'li').length, 2);
    assert.match(text(warning(r)), /Combinaison déjà utilisée/); checks++;
    r.unmount(); r.hookUpdates.length = 0;
    r.patch(4, { action: 'PUSH_TO_TALK' }); await r.tick();
    assert.equal(r.hookUpdates.length, 0);
    r.plugin.stop(); await r.start();
    assert.equal(elements(warning(r), el => el.type === 'li').length, 2);
    assert.equal(r.settings().isFavorite, true);
    assert.equal(r.latestState(), false);
    r.unmount(); r.plugin.stop(); checks++;

    console.log(`${checks} shortcut-conflict behavior/UI checks: PASS`);
    return checks;
}
module.exports = main;
