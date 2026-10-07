const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const vencord = process.argv[2] || process.env.VENCORD_ROOT;
if (!vencord) {
    console.error('Usage: npm run typecheck -- "C:\\path\\to\\Vencord"');
    process.exit(1);
}
const root = path.resolve(vencord);
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const plugin = path.resolve(__dirname, '../shortcutToggle/index.tsx');
const globals = path.join(root, 'src/globals.d.ts');
if (!fs.existsSync(globals)) throw new Error('Vencord global declarations are missing: ' + globals);
const program = ts.createProgram([plugin, globals], { ...parsed.options, noEmit: true });
const normalize = value => value.replace(/\\/g, '/');
const ownErrors = ts.getPreEmitDiagnostics(program).filter(error => error.file && normalize(error.file.fileName) === normalize(plugin));
if (ownErrors.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(ownErrors, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: value => value, getNewLine: () => '\n' }));
    process.exit(1);
}
console.log('ShortcutToggle semantic TypeScript check passed against the supplied Vencord checkout.');
