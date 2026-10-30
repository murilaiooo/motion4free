/**
 * Build an opt-in, same-origin static app-shell cache for partial offline editing.
 * Media, user projects, credentials, AI provider requests and external model
 * downloads never enter this Service Worker cache.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMIT_BYTES = 16 * 1024 * 1024;
const EXCLUDED = /^(?:webllm\.worker|whisper\.worker|ort-wasm)/;
const ELIGIBLE = /\.(?:js|css|woff2?)$/i;

export function generateOfflineShell(directory = resolve('dist')) {
  const html = readFileSync(join(directory, 'index.html'));
  const assets = readdirSync(join(directory, 'assets'), { withFileTypes: true })
    .filter(entry => entry.isFile() && ELIGIBLE.test(entry.name) && !EXCLUDED.test(entry.name))
    .map(entry => ({ name: entry.name, bytes: statSync(join(directory, 'assets', entry.name)).size }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const selected = [];
  let size = html.length;
  // Essential JS/CSS gets first priority; fonts are optional and may be skipped.
  const ordered = [...assets.filter(a => /\.(?:js|css)$/i.test(a.name)), ...assets.filter(a => /\.woff2?$/i.test(a.name))];
  for (const asset of ordered) {
    if (size + asset.bytes > LIMIT_BYTES) {
      if (/\.(?:js|css)$/i.test(asset.name)) throw new Error(`Offline shell too big: required ${asset.name} (${asset.bytes} bytes)`);
      continue;
    }
    selected.push(`./assets/${asset.name}`);
    size += asset.bytes;
  }
  const urls = ['./index.html', ...selected];
  const revision = createHash('sha256').update(html).update(JSON.stringify(urls)).digest('hex').slice(0, 16);
  const sw = `/* Generated static app-shell cache; never cache videos, credentials or API data. */
const PREFIX = 'm4f-shell-';
const NAME = PREFIX + '${revision}';
const PRECACHE = ${JSON.stringify(urls)};
const ASSETS = new Set(PRECACHE.slice(1).map(path => new URL(path, self.registration.scope).pathname));
const INDEX = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(NAME).then(cache =>
    cache.addAll(PRECACHE.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })))
  ));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache service endpoints, user query payloads, media, or arbitrary URLs.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => {
      const cached = await caches.match(INDEX, { cacheName: NAME });
      return cached || Response.error();
    }));
    return;
  }
  if (!ASSETS.has(url.pathname) || url.search) return;
  // Hashed, allowlisted static URLs are invariant across request Accept/Vary headers.
  event.respondWith(caches.open(NAME).then(async cache => (await cache.match(req, { ignoreVary: true })) || fetch(req)));
});
`;
  writeFileSync(join(directory, 'sw.js'), sw);
  return { revision, count: urls.length, bytes: size, urls };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const shell = generateOfflineShell(resolve(process.argv[2] ?? 'dist'));
  console.log(`Offline shell ${shell.revision}: ${shell.count} URLs / ${shell.bytes} bytes (same origin, no user media).`);
}
