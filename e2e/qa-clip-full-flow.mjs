import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.M4F_QA_BASE_URL || 'http://127.0.0.1:5184';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
const report = { kind: 'full-app-with-test-only-ASR', stage: 'loading', pageErrors: [], browserErrors: [] };
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') report.browserErrors.push(msg.text().slice(0,300)); });
try {
  await page.goto(base + '/?asr=clips#clipes', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('long-file-input').setInputFiles('e2e/fixtures/long-tts-repeat-122s-local.mp4');
  report.stage = 'analyzing';
  await page.getByTestId('clip-maker').waitFor({ timeout: 50000 });
  report.stage = 'results';
  const cards = page.getByTestId('clip-card');
  report.cards = await cards.count();
  report.transcription = await page.getByTestId('clips-meta').innerText();
  if (!report.transcription.includes('Transcrição sintética (teste local)')) throw Error('QA transcript must not be mislabeled as a real Whisper model');
  if (report.cards < 2) throw Error('Full app produced fewer than 2 suggestions with the deterministic ASR fixture');
  await page.getByTestId('clip-details').first().click();
  report.inspector = await page.getByTestId('clip-inspector').isVisible();
  await page.getByTestId('clip-title-full').fill('Título revisado no fluxo completo');
  await page.getByTestId('clip-details').first().click();
  report.title = await page.getByTestId('clip-title').first().inputValue();
  const startText = await page.locator('.clip-time').first().innerText();
  report.timestamp = startText;
  await page.getByTestId('clip-preview').first().click();
  report.preview = (await page.getByTestId('clips-preview-context').innerText()).slice(0,120);
  const firstVideoTime = await page.getByTestId('clips-video').evaluate(v => v.currentTime);
  report.sourceSeek = firstVideoTime;
  const secondRange = await page.locator('.clip-time').nth(1).innerText();
  const secondStart = secondRange.trim().match(/^([0-9]+):([0-9]+)/);
  if (!secondStart) throw Error('Cannot parse second candidate source position');
  const secondExpected = Number(secondStart[1]) * 60 + Number(secondStart[2]);
  await page.getByTestId('clip-preview').nth(1).click();
  report.secondPreviewSeek = await page.getByTestId('clips-video').evaluate(v => v.currentTime);
  report.secondExpected = secondExpected;
  if (Math.abs(report.secondPreviewSeek - secondExpected) > 1.5) throw Error('Second source candidate preview seeks to wrong part of original');
  await page.getByTestId('clips-select-none').click();
  report.none = await page.getByTestId('clips-selection-count').innerText();
  await page.getByTestId('clips-select-all').click();
  report.all = await page.getByTestId('clips-selection-count').innerText();
  const dir = path.join(process.cwd(), 'docs/reviews/evidence/issue147/edge');
  fs.mkdirSync(dir,{recursive:true});
  await page.screenshot({ path: path.join(dir,'full-app-with-deterministic-transcript.png'), fullPage:true });
  await page.getByTestId('clip-edit').first().click();
  await page.getByTestId('out-duration').waitFor({ timeout: 60000 });
  report.editor = true;
  await page.getByTestId('menu-close').click();
  await page.getByTestId('clips-resume-open').waitFor({ timeout: 30000 });
  await page.getByTestId('clips-resume-open').click();
  await page.getByTestId('clip-card').first().waitFor();
  report.restoredTitle = await page.getByTestId('clip-title').first().inputValue();
  report.restoredSelection = await page.getByTestId('clips-selection-count').innerText();
  report.resume = report.restoredTitle === 'Título revisado no fluxo completo' && report.restoredSelection === '5 de 5 selecionados';
  report.stage = 'review-resumed';
  report.ok = report.inspector && report.editor && report.resume && report.cards >= 2 && report.pageErrors.length === 0;
} catch(error) {
  report.ok = false;
  report.error = String(error).slice(0,900);
  report.screen = (await page.locator('body').innerText().catch(()=>'')).slice(0,1300);
  try {
    const box = page.locator('[data-testid^="error-"]').first();
    if (await box.count()) {
      await box.locator('summary').click();
      report.diagnostic = (await box.locator('pre').innerText()).slice(0,1200);
    }
  }catch{}
} finally { await browser.close(); }
console.log('FULL_APP_QA '+JSON.stringify(report));
if(!report.ok) process.exitCode = 1;
