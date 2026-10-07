const assert = require('node:assert/strict');
const { createRuntime } = require('./runtime.cjs');
const DAY = 86400000;
const release = (tag, options = {}) => ({ tag_name: tag, draft: false, prerelease: false, ...options });
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
function text(tree) {
    if (tree == null || tree === false) return '';
    if (Array.isArray(tree)) return tree.map(text).join(' ');
    return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function elements(tree, predicate) {
    const found = [];
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (predicate(node)) found.push(node);
        walk(node.props?.children);
    }
    walk(tree); return found;
}
function button(r, label) {
    return elements(r.render(r.testApi.UpdateSettings), node => node.type === 'button' && text(node).includes(label))[0];
}
async function main(code) {
    let checks = 0;
    const r = createRuntime(code); await r.start(); const api = r.testApi;
    for (const [a, b, expected] of [
        ['0.2.10', '0.2.9', 1], ['v0.2.5', '0.2.5', 0], ['1.0.0', '0.99.99', 1],
        ['0.3.0-beta.2', '0.2.5', 1], ['0.3.0', '0.3.0-rc.1', 1],
        ['0.3.0-beta.10', '0.3.0-beta.2', 1], ['0.3.0-2', '0.3.0-beta', -1],
        ['0.3.0-beta', '0.3.0-beta.1', -1], ['0.3.0+build.2', '0.3.0+build.1', 0],
        ['0.2.4', '0.2.5', -1], ['0.3.0-100000000000000000000', '0.3.0-99999999999999999999', 1],
        ['01.2.3', '1.2.3', null], ['1.2', '1.2.3', null], ['1.2.3-beta.01', '1.2.3', null],
        ['1.2.3/path', '1.2.3', null], ['999999999999999999.2.3', '1.2.3', null]
    ]) { assert.equal(api.compareReleaseVersions(a, b), expected, `${a} vs ${b}`); checks++; }

    r.settings().updateNotificationsEnabled = false;
    await r.tick(30000); assert.equal(r.requests.length, 0);
    assert.match(text(r.render(api.UpdateSettings)), /Version installée.*0\.2\.5/); checks++;

    r.toggle(); const selection = Array.from(r.settings().selectedKeybindIds), writes = r.writes.length;
    const body = [release('v0.2.5'), release('v0.2.10', { prerelease: true,
        html_url: 'https://untrusted.invalid/', name: '<script>ignored</script>' }),
        release('v99.0.0', { draft: true }), release('v0.2.9'), release('latest')];
    // Ignore unpublished drafts and choose numeric version order, not list order.
    r.setFetchHandler(async () => response(body));
    await api.checkForUpdates();
    assert.equal(api.getUpdateCheckView().status, 'available');
    assert.equal(api.getUpdateCheckView().latest.version, '0.2.10');
    assert.match(text(r.render(api.UpdateSettings)), /Nouvelle version disponible.*0\.2\.10.*préversion/);
    assert.equal(r.notifications.length, 1); checks++;
    button(r, 'Ouvrir le téléchargement').props.onClick(); r.notifications[0].onClick();
    assert.deepEqual(r.openedUrls, [
        'https://github.com/Sheixo/ShortcutToggle/releases/tag/v0.2.10',
        'https://github.com/Sheixo/ShortcutToggle/releases/tag/v0.2.10'
    ]);
    const request = r.requests[0];
    assert.equal(request.url, 'https://api.github.com/repos/Sheixo/ShortcutToggle/releases?per_page=100');
    assert.equal(request.options.credentials, 'omit'); assert.equal(request.options.referrerPolicy, 'no-referrer');
    assert.equal(request.options.headers.Authorization, undefined); checks++;
    await api.checkForUpdates(); assert.equal(r.notifications.length, 1);
    assert.equal(r.writes.length, writes); assert.deepEqual(Array.from(r.settings().selectedKeybindIds), selection);
    assert.match(text(r.render(api.ShortcutStatus)), /OFF/); checks++;

    const snapshot = api.getUpdateCheckView(); snapshot.latest.url = 'https://untrusted.invalid/';
    assert.match(api.getUpdateCheckView().latest.url, /^https:\/\/github\.com\/Sheixo\/ShortcutToggle\//);
    r.unmount(); r.plugin.stop(); await r.start();
    assert.equal(api.getUpdateCheckView().status, 'available');
    assert.equal(r.notifications.length, 1);
    r.settings().updateNotificationsEnabled = true;
    await r.tick(20000); assert.equal(r.notifications.length, 1); checks++;

    // Current/older releases do not announce an update, even if the response is unordered.
    for (const body of [[release('v0.2.5')], [release('v0.2.4')], [release('v0.2.5+newbuild')]]) {
        r.setFetchHandler(async () => response(body)); await api.checkForUpdates();
        assert.equal(api.getUpdateCheckView().status, 'current');
        assert.equal(r.notifications.length, 1);
        assert.equal(button(r, 'Ouvrir le téléchargement'), undefined); checks++;
    }

    for (const [mode, body, status, expected] of [
        ['rate', [], 403, /GitHub refuse/], ['rate429', [], 429, /GitHub refuse/],
        ['server', [], 500, /Vérification impossible/], ['notArray', {}, 200, /Aucune version/],
        ['empty', [], 200, /Aucune version/], ['invalidTag', [release('v0.2.6/evil')], 200, /Aucune version/],
        ['draftOnly', [release('v9.0.0', { draft: true })], 200, /Aucune version/]
    ]) {
        r.setFetchHandler(async () => response(body, status)); await api.checkForUpdates();
        assert.equal(api.getUpdateCheckView().status, 'error', mode);
        assert.match(text(r.render(api.UpdateSettings)), expected); checks++;
    }
    r.setFetchHandler(async () => { throw new Error('offline'); }); await api.checkForUpdates();
    assert.match(text(r.render(api.UpdateSettings)), /connexion Internet/); checks++;
    r.setFetchHandler(async () => ({ ok: true, json: async () => { throw new Error('bad JSON'); } }));
    await api.checkForUpdates(); assert.equal(api.getUpdateCheckView().status, 'error'); checks++;

    let resolve;
    r.setFetchHandler(() => new Promise(done => { resolve = done; }));
    const timeout = api.checkForUpdates(); const count = r.requests.length;
    await api.checkForUpdates(); assert.equal(r.requests.length, count);
    assert.equal(button(r, 'Vérification').props.disabled, true);
    await r.tick(10000); await timeout;
    assert.match(text(r.render(api.UpdateSettings)), /dix secondes/);
    assert.equal(r.requests.at(-1).options.signal.aborted, true);
    resolve(response([release('v8.0.0')])); await r.tick();
    assert.equal(api.getUpdateCheckView().status, 'error'); assert.equal(r.notifications.length, 1); checks++;

    // Stop and restart before a fetch resolves: stale response must not modify the new session.
    const pending = api.checkForUpdates(), oldResolve = resolve;
    r.unmount(); r.plugin.stop(); await r.start();
    oldResolve(response([release('v9.0.0')])); await pending;
    assert.notEqual(api.getUpdateCheckView().latest?.version, '9.0.0');
    assert.equal(r.notifications.length, 1); checks++;
    r.unmount(); r.plugin.stop();

    // Daily cadence and cached results persist across a plugin restart.
    const daily = createRuntime(code); await daily.start();
    const dailyApi = daily.testApi;
    daily.setFetchHandler(async () => response([release('v0.2.6', { prerelease: true })]));
    await daily.tick(19500); assert.equal(daily.requests.length, 1);
    assert.equal(daily.notifications.length, 1); checks++;
    await daily.tick(DAY - 1); assert.equal(daily.requests.length, 1);
    await daily.tick(1); assert.equal(daily.requests.length, 2);
    assert.equal(daily.notifications.length, 1); checks++;
    daily.plugin.stop(); await daily.start();
    await daily.tick(20000); assert.equal(daily.requests.length, 2);
    assert.equal(daily.notifications.length, 1); checks++;
    daily.setFetchHandler(async () => response([release('v0.2.7')]));
    await dailyApi.checkForUpdates(); assert.equal(daily.notifications.length, 2); checks++;
    daily.setFetchHandler(async () => response([release('v0.2.6')]));
    await dailyApi.checkForUpdates(); assert.equal(daily.notifications.length, 2); checks++;
    daily.settings().updateNotificationsEnabled = false;
    const before = daily.requests.length; await daily.tick(DAY * 2);
    assert.equal(daily.requests.length, before);
    await dailyApi.checkForUpdates(); assert.equal(daily.requests.length, before + 1); checks++;
    daily.plugin.stop();

    // A failed check is retried in an hour, without persisting a false success.
    const retry = createRuntime(code); await retry.start();
    retry.setFetchHandler(async () => response([], 429));
    await retry.tick(19500); assert.equal(retry.requests.length, 1);
    assert.equal(retry.settings().lastUpdateCheckAt, 0);
    await retry.tick(3599999); assert.equal(retry.requests.length, 1);
    await retry.tick(1); assert.equal(retry.requests.length, 2); checks++;
    retry.plugin.stop();

    // Canceling an automatic request and re-enabling checks must not allow its
    // old scheduler to replace the new twenty-second startup check.
    const lifecycle = createRuntime(code); await lifecycle.start();
    let finish;
    lifecycle.setFetchHandler(() => new Promise(done => { finish = done; }));
    const tick = lifecycle.tick(19500); await Promise.resolve();
    assert.equal(lifecycle.requests.length, 1);
    lifecycle.settings().updateNotificationsEnabled = false;
    assert.equal(lifecycle.requests[0].options.signal.aborted, true);
    lifecycle.settings().updateNotificationsEnabled = true;
    finish(response([release('v4.0.0')])); await tick;
    assert.equal(lifecycle.notifications.length, 0);
    lifecycle.setFetchHandler(async () => response([release('v0.2.5')]));
    await lifecycle.tick(20000); assert.equal(lifecycle.requests.length, 2);
    assert.equal(lifecycle.testApi.getUpdateCheckView().status, 'current'); checks++;
    lifecycle.settings().latestUpdateRelease = { tag: 'v0.2.8', prerelease: false, url: 'https://untrusted.invalid/' };
    lifecycle.settings().lastUpdateCheckAt = 99999999999999;
    lifecycle.settings().updateNotificationsEnabled = false;
    lifecycle.plugin.stop(); await lifecycle.start();
    assert.equal(lifecycle.testApi.getUpdateCheckView().checkedAt, null);
    button(lifecycle, 'Ouvrir le téléchargement').props.onClick();
    assert.equal(lifecycle.openedUrls.at(-1), 'https://github.com/Sheixo/ShortcutToggle/releases/tag/v0.2.8'); checks++;
    lifecycle.unmount(); lifecycle.plugin.stop();
    console.log(`${checks} update/version/notification checks: PASS`);
    return checks;
}
module.exports = main;
