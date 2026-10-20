// Grava quadros da galeria (`?galeria`) de cada modelo em PNG, para olhar os modelos sem abrir o app.
// Uso: com o site rodando (`npx vite preview --port 4180`), `node scripts/render-templates.mjs <pasta> [porta] [id...]`.
// Também mede o tempo médio de desenho de um quadro 1080×1920 (`bench`) de cada modelo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [out = 'templates-png', port = '4180', ...only] = process.argv.slice(2);
const SHOTS = [
  ['abertura', 1.3],
  ['numero', 4.6],
  ['lista', 8.6],
  ['pergunta', 12.2],
  ['nome', 15.8],
  ['legenda', 22.1],
  ['chamada', 26.6],
];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/?galeria`);
await page.waitForSelector('[data-testid=gallery][data-ready="1"]', { timeout: 60_000 });
const ids = only.length ? only : await page.evaluate(() => window.m4fGallery.styles());
const bench = {};
for (const id of ids) {
  for (const [shot, t] of SHOTS) {
    const url = await page.evaluate(([s, tt]) => window.m4fGallery.render(s, tt, 540), [id, t]);
    writeFileSync(`${out}/${id}-${shot}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  if (process.env.BENCH) bench[id] = await page.evaluate((s) => window.m4fGallery.bench(s, 120), id);
}
if (process.env.BENCH) console.log(JSON.stringify(bench, null, 1));
await browser.close();
