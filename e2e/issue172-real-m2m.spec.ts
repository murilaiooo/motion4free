import { test, expect } from '@playwright/test';
import { editCaption, pickVideos, tab } from './ui';
import { readFile } from 'node:fs/promises';

test('M2M100 translates Russian captions to Portuguese and preserves the source (#172)', async ({ page }, info) => {
  test.skip(process.env.M4F_REAL_M2M !== '1', 'Downloads the real multilingual translation model');
  test.setTimeout(600_000);
  const weights: string[] = [];
  page.context().on('request', (request) => {
    if (request.url().includes('Xenova/m2m100_418M/resolve/') && request.url().includes('/onnx/')) weights.push(request.url());
  });
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  const captions = () => page.evaluate(() => (window as any).__m4f.plan.captions as { id: string; text: string; start: number; end: number }[]);
  const ids = (await captions()).map(c => c.id);
  expect(ids).toHaveLength(2);
  await editCaption(page, ids[0]!, 'Доброе утро.');
  await editCaption(page, ids[1]!, 'Большое спасибо.');
  const original = await captions();
  await page.getByTestId('translation-source').selectOption('ru');
  await page.getByTestId('translation-target').selectOption('pt');
  await page.getByTestId('translate-subtitles').click();
  const translated = page.getByTestId('subtitle-track-translated');
  const error = page.getByTestId('translation-error');
  await expect(translated.or(error)).toBeVisible({ timeout: 480_000 });
  expect(await error.allTextContents()).toEqual([]);
  expect(weights.length).toBeGreaterThan(0);
  expect(weights.every(url => url.includes('/9c374f0b7aca709787cea97b047bfbbd1559d177/'))).toBe(true);
  const cues = await captions();
  await info.attach('synthetic-pt', {body: JSON.stringify(cues.map(c => c.text)), contentType:'application/json'});
  // Golden output of the pinned model. The literal greeting needs an editorial correction in pt-BR.
  expect(cues.map(c => c.text)).toEqual(['Boa manhã.', 'Muito obrigado.']);
  await editCaption(page, cues[0]!.id, 'Bom dia.');
  const corrected = await captions();
  expect(corrected.map(c => c.text)).toEqual(['Bom dia.', 'Muito obrigado.']);
  expect(cues.map(c => [c.start,c.end])).toEqual(original.map(c => [c.start,c.end]));
  const download = page.waitForEvent('download');
  await page.getByTestId('download-srt').click();
  const srt = await readFile((await (await download).path())!, 'utf8');
  for (const cue of corrected) expect(srt).toContain(cue.text);
  await expect(page.getByTestId('saved')).toBeVisible();
  await page.reload();
  await tab(page, 'Legendas');
  await expect(translated).toBeChecked();
  expect(await captions()).toEqual(corrected);
  expect(await page.evaluate(() => (window as any).__m4f.plan.subtitleTranslation.model)).toEqual({
    repo: 'Xenova/m2m100_418M', revision: '9c374f0b7aca709787cea97b047bfbbd1559d177',
  });
  await page.getByTestId('subtitle-track-original').check();
  expect(await captions()).toEqual(original);
});
