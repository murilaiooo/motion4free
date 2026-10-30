import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const inventoryPath = join(root, 'public/asset-provenance.json');
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const fail = (msg) => { throw new Error('[license audit] ' + msg); };
const names = new Set();
const hashes = new Map();
for (const entry of inventory.assets) {
  const source = resolve(root, entry.file);
  if (!existsSync(source)) fail('missing source: ' + entry.file);
  if (!['OFL-1.1'].includes(entry.license)) fail('unreviewed binary license: ' + entry.file);
  if (!entry.package || !entry.version || !entry.source || !entry.restrictions || !entry.notice || !entry.usedBy?.length) fail('incomplete record: ' + entry.file);
  if (!existsSync(resolve(root, entry.notice.startsWith('/') ? 'public/' + entry.notice.slice(1) : entry.notice))) fail('missing notice: ' + entry.notice);
  if (statSync(source).size !== entry.bytes || hash(source) !== entry.sha256) fail('changed binary without review: ' + entry.file);
  if (hashes.has(entry.sha256)) fail('duplicate source hash: ' + entry.file);
  hashes.set(entry.sha256, entry);
}
if (!existsSync(dist)) fail('production dist missing: run npm run build');
function recursive(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? recursive(join(dir, entry.name)) : [join(dir, entry.name)]);
}
const emitted = recursive(dist);
const woff = emitted.filter(file => file.endsWith('.woff2'));
for (const file of woff) {
  const fingerprint = hash(file);
  const entry = hashes.get(fingerprint);
  if (!entry) fail('unreviewed emitted font: ' + file);
  names.add(entry.file);
}
if (woff.length !== inventory.assets.length || names.size !== inventory.assets.length) {
  fail('font emitted/source mismatch: dist=' + woff.length + ', reviewed=' + inventory.assets.length);
}
const unknownBinary = emitted.filter(file =>
  /\.(?:wasm|onnx|bin|a|so|dll|mp3|mp4|wav|mov|ttf|otf)$/i.test(file));
if (unknownBinary.length) fail('unreviewed distributed binary: ' + unknownBinary.join(', '));
if (emitted.some(file => /aac-encoder/i.test(basename(file)))) fail('unreviewed AAC bundle in dist');
const deps = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies;
if (deps['@mediabunny/aac-encoder']) fail('embedded FFmpeg AAC package must not ship until corresponding source is verified');
for (const runtime of inventory.runtimes) {
  if (runtime.package === '@mediabunny/aac-encoder') fail('removed runtime still listed');
  if (!runtime.declaredLicense || !runtime.version || !runtime.source) fail('incomplete runtime record: ' + runtime.package);
}
for (const notice of ['licencas-fontes.txt', 'licencas-icones.txt', 'licencas-runtime.txt', 'asset-provenance.json']) {
  if (!existsSync(join(dist, notice)) || !statSync(join(dist, notice)).size) fail('notice missing from deploy: ' + notice);
}
console.log('[license audit] verified ' + woff.length + ' distributed fonts against reviewed SHA-256, ' +
  inventory.runtimes.length + ' runtime entries, all public notices, no unreviewed binary');
