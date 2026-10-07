/* ShortcutToggle — Copyright (c) 2026 Ethan. SPDX-License-Identifier: GPL-3.0-or-later */
(() => {
    const get = id => document.getElementById(id);
    const ACTION_UUID = 'fr.ethan.discord-shortcuts.toggle';
    let socket = null, context = '', registered = false;
    const send = payload => {
        if (!registered || socket?.readyState !== WebSocket.OPEN) return false;
        try { socket.send(JSON.stringify({ event: 'sendToPlugin', action: ACTION_UUID, context, payload })); return true; }
        catch { disconnected(); return false; }
    };
    function disconnected() {
        registered = false; get('check').disabled = true; get('automatic').disabled = true;
        get('download-row').hidden = true; get('update-status').textContent = 'Le panneau est déconnecté. Sélectionne de nouveau la touche.';
        get('connection').textContent = 'Indisponible'; get('connection').className = 'badge offline';
    }
    function show(payload) {
        if (!payload || payload.type !== 'companionSettings') return;
        const update = payload.updates, connection = payload.connection;
        if (!update || !connection || typeof update.installedVersion !== 'string' || typeof update.message !== 'string'
            || typeof update.automaticChecks !== 'boolean' || typeof connection.connected !== 'boolean' || typeof connection.disabled !== 'boolean') return;
        get('version').textContent = update.installedVersion;
        get('automatic').checked = update.automaticChecks;
        get('automatic').disabled = !update.initialized;
        get('check').disabled = update.status === 'checking';
        get('check').textContent = update.status === 'checking' ? 'Recherche en cours…' : 'Rechercher les mises à jour';
        get('update-status').textContent = update.message;
        get('download-row').hidden = !update.downloadUrl;
        get('checked-at').textContent = Number.isFinite(update.lastCheckedAt) && update.lastCheckedAt > 0
            ? 'Dernière vérification : ' + new Date(update.lastCheckedAt).toLocaleString('fr-FR') : '';
        get('connection').textContent = connection.connected ? (connection.disabled ? 'OFF' : 'ON') : 'Hors ligne';
        get('connection').className = connection.connected ? 'badge online' : 'badge offline';
    }
    get('check').addEventListener('click', () => { if (send({ type: 'checkCompanionUpdates' })) get('check').disabled = true; });
    get('automatic').addEventListener('change', () => {
        if (send({ type: 'setAutomaticChecks', enabled: get('automatic').checked })) get('automatic').disabled = true;
    });
    get('download').addEventListener('click', () => send({ type: 'openLink', link: 'download' }));
    get('release').addEventListener('click', () => send({ type: 'openLink', link: 'release' }));
    for (const link of document.querySelectorAll('[data-link]')) link.addEventListener('click', ev => {
        ev.preventDefault(); send({ type: 'openLink', link: link.dataset.link });
    });
    window.connectElgatoStreamDeckSocket = (port, uuid, event, info, actionInfo) => {
        try {
            if (!/^\d{1,5}$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) throw Error('Invalid port');
            const action = JSON.parse(actionInfo), app = JSON.parse(info);
            if (action.action !== ACTION_UUID || typeof action.context !== 'string') throw Error('Unexpected action');
            if (typeof app.plugin?.version === 'string') get('version').textContent = app.plugin.version;
            context = action.context;
            if (socket) { socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null; socket.close(); }
            const current = new WebSocket('ws://127.0.0.1:' + port); socket = current;
            current.onopen = () => {
                if (socket !== current) return;
                try { current.send(JSON.stringify({ event, uuid })); registered = true; send({ type: 'getCompanionSettings' }); }
                catch { disconnected(); }
            };
            current.onmessage = ev => {
                if (socket !== current) return;
                try { const message = JSON.parse(ev.data); if (message.event === 'sendToPropertyInspector' && message.context === context) show(message.payload); }
                catch { /* Incompatible messages cannot change controls or open URLs. */ }
            };
            current.onclose = current.onerror = () => { if (socket === current) disconnected(); };
        } catch { disconnected(); }
    };
})();
