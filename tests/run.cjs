const fs = require('node:fs');
const path = require('node:path');
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild');
const source = fs.readFileSync(path.resolve(__dirname, '../shortcutToggle/index.tsx'),'utf8');
const instrumentation = '\nexport const __test = {startShortcutRecording, cancelShortcutRecording, resetToggleShortcut, getView: () => shortcutRecordingView, filterKeybinds, setKeybindSelection, ShortcutSettings, ShortcutRecorder, KeybindSelector, ShortcutStatus, StreamDeckSettings, getStreamDeckStatus: () => streamDeckStatus, reconnectStreamDeck, checkStreamDeckConnection, getStreamDeckDiagnostics, UpdateSettings, checkForUpdates, getUpdateCheckView, compareReleaseVersions, PLUGIN_VERSION};\n';
async function run() {
    const result = await esbuild.transform(source + instrumentation, { loader:'tsx', target:'esnext', format:'cjs', jsx:'automatic' });
    const total = await require('./keybinds.cjs')(result.code)
        + await require('./recorder.cjs')(result.code)
        + await require('./interface.cjs')(result.code)
        + await require('./conflicts.cjs')(result.code)
        + await require('./streamdeck.cjs')(result.code)
        + await require('./updates.cjs')(result.code);
    console.log(`Full TSX compilation and ${total} simulated checks passed.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
