#!/usr/bin/env node
/**
 * Lista textos em português da interface que ainda não têm tradução em src/i18n/en/*.ts (ADR-0041).
 * Uso: node scripts/i18n-missing.mjs [pasta]   (padrão: src/app)
 * É uma ajuda, não um teste: usa expressões simples, então pode listar algo que não aparece na tela
 * (palavras-chave, prompts) e deixar passar texto muito picado. Texto sem tradução continua em português;
 * nada quebra.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'src/app';
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const keys = new Set();
for (const f of readdirSync('src/i18n/en')) {
  const src = readFileSync(join('src/i18n/en', f), 'utf8');
  for (const m of src.matchAll(/^\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*:/gm)) {
    const raw = m[1];
    keys.add(norm(raw.startsWith('"') ? JSON.parse(raw) : raw.slice(1, -1).replace(/\\'/g, "'")));
  }
}

const PT = /[áàâãéêíóôõúç]|\b(de|da|do|com|sem|para|não|um|uma|que|por|seu|sua|vídeo|legenda|clipe|projeto)\b/i;
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p);
  }
})(root);

let missing = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const found = new Set();
  // texto de JSX entre tags e expressões
  for (const m of src.matchAll(/[>}]([^<>{}=;]*[A-Za-zÀ-ú][^<>{}=;]*)[<{]/g)) found.add(norm(m[1]));
  // textos entre aspas e templates
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)+)'|"((?:[^"\\\n]|\\.)+)"|`((?:[^`\\]|\\.)+)`/g)) {
    const t = m[1] ?? m[2] ?? m[3];
    let i = 0;
    found.add(norm(t.replace(/\$\{[^}]*\}/g, () => `{${i++}}`)));
  }
  const list = [...found].filter((t) => t && PT.test(t) && /[A-Za-zÀ-ú]{3}/.test(t) && !keys.has(t) && !/^(import|export)\b|=>|className|\|/.test(t));
  if (list.length) {
    console.log(`\n${file}`);
    for (const t of list) console.log(`  ${JSON.stringify(t)}`);
    missing += list.length;
  }
}
console.log(`\n${missing} texto(s) possivelmente sem tradução.`);
