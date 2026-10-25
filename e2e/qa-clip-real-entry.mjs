import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: true, executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const result = { scenario: 'real-app-entry-local-synthetic-video', errors: [], state: 'started' };
page.on('pageerror', error => result.errors.push(error.message));
try {
  await page.goto((process.env.M4F_QA_BASE_URL || 'http://127.0.0.1:5183') + '/#clipes', { waitUntil: 'domcontentloaded' });
  const input = page.getByTestId('long-file-input');
  await input.waitFor({ timeout: 30000 });
  await input.setInputFiles('e2e/fixtures/long-tts-122s-local.mp4');
  result.state = 'imported-synthetic-video';
  try {
    await page.getByTestId('clip-maker').waitFor({ timeout: 150000 });
    result.state = 'clip-review-loaded';
    result.cards = await page.getByTestId('clip-card').count();
    result.transcript = await page.getByTestId('clips-meta').textContent();
    if (result.cards === 0) {
      await page.getByTestId('clips-length-curto').click();
      result.cardsAfterChangingLength = await page.getByTestId('clip-card').count();
      result.cards = result.cardsAfterChangingLength;
    }
    const outputDir = path.join(process.cwd(), 'docs/reviews/evidence/issue147/edge');
    fs.mkdirSync(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, 'real-app-entry.png'), fullPage: true });
    if (result.cards) {
      await page.getByTestId('clip-details').first().click();
      result.inspector = await page.getByTestId('clip-inspector').isVisible();
      await page.getByTestId('clip-check').first().uncheck();
      result.selectionAfter = await page.getByTestId('clips-selection-count').textContent();
      await page.getByTestId('clip-title').first().fill('Título revisado antes de abrir no editor');
      result.renamed = await page.getByTestId('clip-title').first().inputValue();
      await page.getByTestId('clip-preview').first().click();
      result.preview = (await page.getByTestId('clips-preview-context').innerText()).slice(0,120);
      await page.getByTestId('clip-edit').first().click();
      await page.getByTestId('out-duration').waitFor({ timeout: 60000 });
      result.editorOpened = true;
    }
  } catch (error) {
    result.state = 'entry-blocked-or-timeout';
    result.exception = String(error).slice(0,500);
    result.screen = (await page.locator('body').innerText()).slice(0,1200);
  }
} catch (error) {
  result.state = 'input-failed';
  result.exception = String(error).slice(0,500);
} finally {
  await browser.close();
}
console.log('REAL_CLIP_ENTRY', JSON.stringify(result));
if (result.state !== 'clip-review-loaded' || result.errors.length) process.exitCode = 1;
