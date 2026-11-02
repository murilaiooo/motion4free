// Mede o que o navegador baixa na primeira tela (#156): JS/CSS citados no dist/index.html
// (script de entrada + modulepreload + folhas de estilo) contra o que só carrega sob demanda.
// Uso: npx vite build && node scripts/measure-bundle.mjs [--json]
// Mede bytes (bruto, gzip, brotli). Não mede tempo no navegador: isso fica para o teste no Brave.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const initial = new Set([...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]));

function sizes(file) {
  const buf = readFileSync(join(dist, file));
  return {
    raw: buf.length,
    gzip: gzipSync(buf, { level: 9 }).length,
    brotli: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
}

const all = readdirSync(join(dist, 'assets')).filter((f) => /\.(js|css)$/.test(f)).map((f) => `assets/${f}`);
const rows = all.map((file) => ({ file, initial: initial.has(file), ...sizes(file) })).sort((a, b) => b.raw - a.raw);
const sum = (list, key) => list.reduce((s, r) => s + r[key], 0);
const first = rows.filter((r) => r.initial);
const lazy = rows.filter((r) => !r.initial);
const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ firstLoad: { files: first.length, raw: sum(first, 'raw'), gzip: sum(first, 'gzip'), brotli: sum(first, 'brotli') }, lazy: { files: lazy.length, raw: sum(lazy, 'raw') }, rows }, null, 2));
} else {
  console.log(`Primeira tela: ${first.length} arquivos · ${kb(sum(first, 'raw'))} bruto · ${kb(sum(first, 'gzip'))} gzip · ${kb(sum(first, 'brotli'))} brotli`);
  for (const r of first) console.log(`  ${r.file.padEnd(48)} ${kb(r.raw).padStart(12)} ${kb(r.gzip).padStart(12)} gz`);
  console.log(`Sob demanda: ${lazy.length} arquivos · ${kb(sum(lazy, 'raw'))} bruto`);
  for (const r of lazy.slice(0, 12)) console.log(`  ${r.file.padEnd(48)} ${kb(r.raw).padStart(12)}`);
}
