const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'stream-deck/fr.ethan.discord-shortcuts.sdPlugin/manifest.json'), 'utf8'));
const tag = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) throw Error('Usage: node scripts/prepare-companion-release.cjs v0.2.7');
const installer = 'fr.ethan.discord-shortcuts.streamDeckPlugin';
const bytes = fs.readFileSync(path.join(root, 'releases', installer));
const descriptor = { schemaVersion: 1, pluginUUID: manifest.UUID, version: manifest.Version, releaseTag: tag,
    installer, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
fs.writeFileSync(path.join(root, 'releases/streamdeck-update.json'), JSON.stringify(descriptor, null, 2) + '\n');
console.log('Companion update descriptor generated; upload it alongside its installer in the same release.');
