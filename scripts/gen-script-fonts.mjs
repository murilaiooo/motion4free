/**
 * Gera src/media/script-font-ranges.ts a partir do CSS dos pacotes @fontsource (peso 700):
 * a faixa Unicode de cada arquivo das fontes de reserva por escrita (chinês, árabe/urdu, hindi, bengali).
 * Rodar de novo só quando a versão dos pacotes mudar: `node scripts/gen-script-fonts.mjs`.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PACKAGES = [
  { pkg: 'noto-sans-sc', family: 'Noto Sans SC', script: 'han', subset: /^\d+$/ },
  { pkg: 'noto-sans-arabic', family: 'Noto Sans Arabic', script: 'arabic', subset: /^arabic$/ },
  { pkg: 'noto-sans-devanagari', family: 'Noto Sans Devanagari', script: 'devanagari', subset: /^devanagari$/ },
  { pkg: 'noto-sans-bengali', family: 'Noto Sans Bengali', script: 'bengali', subset: /^bengali$/ },
];

const out = [];
for (const p of PACKAGES) {
  const css = readFileSync(`node_modules/@fontsource/${p.pkg}/700.css`, 'utf8');
  const faces = [...css.matchAll(/files\/([a-z0-9-]+)-700-normal\.woff2\)[^;]*;\s*unicode-range:\s*([^;]+);/g)];
  for (const [, base, range] of faces) {
    const subset = base.slice(p.pkg.length + 1);
    if (!p.subset.test(subset)) continue;
    out.push({ script: p.script, family: p.family, file: `${base}-700-normal.woff2`, range: range.trim().replace(/\s+/g, '') });
  }
}
const body = `/* Gerado por scripts/gen-script-fonts.mjs a partir do CSS dos pacotes @fontsource. Não editar à mão. */
export interface ScriptFontFile { script: 'han' | 'arabic' | 'devanagari' | 'bengali'; family: string; file: string; range: string }
export const SCRIPT_FONT_FILES: ScriptFontFile[] = ${JSON.stringify(out, null, 0).replace(/},{/g, '},\n{')};
`;
writeFileSync('src/media/script-font-ranges.ts', body);
console.log(`${out.length} arquivos`);
