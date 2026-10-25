import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const outdir = path.join(process.cwd(), 'docs/reviews/evidence/issue147/edge');
fs.mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  args: ['--no-sandbox'],
});
const scenarios = [
  ...[0, 1, 3, 8, 10].flatMap(count => [390, 768, 1440].map(width => ({ count, width, height: width === 390 ? 844 : width === 768 ? 900 : 900, zoom: 1 }))),
  ...[1.25, 2].flatMap(zoom => [390, 1024, 1440].map(width => ({ count: 8, width, height: width === 390 ? 844 : 900, zoom }))),
  { count: 10, width: 390, height: 844, zoom: 1, sourcewidth: 1080, sourceheight: 1920 },
  { count: 10, width: 768, height: 900, zoom: 1, sourcewidth: 1080, sourceheight: 1080 },
];
const output = [];
for (const [n, s] of scenarios.filter(s => !process.env.EDGE_ONLY_ZOOM || s.zoom !== 1).entries()) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  try {
    const p = new URLSearchParams({ clips: String(s.count), sourcewidth: String(s.sourcewidth ?? 1920), sourceheight: String(s.sourceheight ?? 1080) });
    await page.goto('http://127.0.0.1:5181/e2e/clip-review-lab.html?' + p, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('clips-review').waitFor({ timeout: 20000 });
    if (s.count) await page.getByTestId('clip-card').first().waitFor({ timeout: 20000 });
    // Real browser zoom shrinks the CSS layout viewport and re-evaluates media queries.
    // Changing root CSS zoom alone does not, so reproduce the effective CSS viewport.
    if (s.zoom !== 1) await page.setViewportSize({ width: Math.floor(s.width / s.zoom), height: Math.floor(s.height / s.zoom) });
    const count = await page.getByTestId('clip-card').count();
    const firstCount = await page.getByTestId('clips-selection-count').textContent();
    let testedKeyboard = false;
    if (count) {
      await page.getByTestId('clips-select-all').click();
      const check = page.getByTestId('clip-check').first();
      await check.focus();
      await page.keyboard.press('Space');
      testedKeyboard = !(await check.isChecked());
      await page.getByTestId('clip-title').first().fill('Um título longo que precisa continuar visível e editável mesmo em telas muito estreitas e também ampliadas');
      await page.getByTestId('clip-details').first().click();
      await page.getByTestId('clip-title-full').fill('Título completo e revisado via inspector');
      await page.getByTestId('clip-details').first().click();
      await page.getByTestId('clip-card').last().scrollIntoViewIfNeeded();
    } else {
      await page.getByText('Nenhum momento encontrado ainda').waitFor();
    }
    const geometry = await page.evaluate(() => {
      const view = innerWidth;
      const cards = [...document.querySelectorAll('[data-testid="clip-card"]')];
      const visibility = [];
      for (const card of cards) {
        const cb = card.getBoundingClientRect();
        for (const button of card.querySelectorAll('.clip-card-actions button,.clip-card-actions a')) {
          const b = button.getBoundingClientRect();
          if (b.left < cb.left - 1 || b.right > cb.right + 1) visibility.push('button escapes card');
        }
        const title = card.querySelector('[data-testid="clip-title"]')?.getBoundingClientRect();
        if (title && title.width < 95) visibility.push('title width <95');
      }
      const bar = document.querySelector('.clips-bar')?.getBoundingClientRect();
      const last = cards.at(-1)?.getBoundingClientRect();
      return { view, scrollWidth: document.documentElement.scrollWidth, barHeight: bar?.height, lastBottom: last?.bottom, cardCount: cards.length, faults: visibility };
    });
    const ok = count === s.count && geometry.scrollWidth <= geometry.view + 2 && geometry.faults.length === 0 && testedKeyboard === (s.count > 0) && errors.length === 0;
    output.push({ ...s, ok, count, firstCount, geometry, errors });
    if (!ok) console.log('EDGE_FAIL', JSON.stringify(output.at(-1)));
    if ([0, 1, 10].includes(s.count) && [390, 1440].includes(s.width) && s.zoom === 1) {
      await page.screenshot({ path: path.join(outdir, 'clips-' + s.count + '-' + s.width + '.png'), fullPage: true, animations: 'disabled' });
    }
    if (s.zoom !== 1 && s.width === 390) await page.screenshot({ path: path.join(outdir, 'zoom-' + String(s.zoom) + '-390.png'), fullPage: true });
  } catch (e) {
    output.push({ ...s, ok: false, error: String(e), errors });
    console.log('EDGE_ERROR', JSON.stringify(output.at(-1)));
  } finally {
    await page.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outdir, 'qa-edge-metrics.json'), JSON.stringify(output, null, 2));
const failed = output.filter(x => !x.ok);
console.log('EDGE_SUMMARY', JSON.stringify({ tested: output.length, failed: failed.length, failures: failed }));
if (failed.length) process.exitCode = 1;
