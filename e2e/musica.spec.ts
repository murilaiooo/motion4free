import { expect, test } from '@playwright/test';
import { tab } from './ui';

/** WAV de 6 s com um tom simples: música de teste gerada aqui, sem arquivo de terceiros. */
function toneWav(seconds = 6, rate = 22050): Buffer {
  const samples = seconds * rate;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const musicOf = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __m4f: { plan: { music?: unknown } } }).__m4f.plan.music ?? null);

test('música de fundo: escolher, ajustar, continuar no projeto e tirar (v0.26)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Áudio');
  await page.getByTestId('music-input').setInputFiles({ name: 'trilha.wav', mimeType: 'audio/wav', buffer: toneWav() });
  await expect(page.getByTestId('music-card')).toContainText('trilha.wav');
  expect(await musicOf(page)).toEqual({ name: 'trilha.wav', volume: 0.25, duck: true });
  await page.getByTestId('music-duck').uncheck();
  expect(await musicOf(page)).toMatchObject({ duck: false });

  // arquivo que não é música: erro próprio e nada muda
  await page.getByTestId('music-input').setInputFiles({ name: 'nao-e-musica.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('isto não é áudio') });
  await expect(page.getByTestId('error-M4F-203')).toBeVisible();
  expect(await musicOf(page)).toMatchObject({ name: 'trilha.wav' });

  // reabrir: a música volta junto com o projeto, sem o aviso de música perdida
  await page.reload();
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Áudio');
  await expect(page.getByTestId('music-card')).toContainText('trilha.wav');
  await expect(page.getByTestId('warning-M4F-205')).toHaveCount(0);

  await page.getByTestId('music-remove').click();
  expect(await musicOf(page)).toBeNull();
  await expect(page.getByTestId('music-pick')).toBeVisible();
});

test('legenda em arquivo: baixa um .srt com as falas do vídeo editado (v0.26)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Legendas');
  const download = page.waitForEvent('download');
  await page.getByTestId('download-srt').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/-legendas\.srt$/);
  const text = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8');
  expect(text).toMatch(/^1\n\d\d:\d\d:\d\d,\d\d\d --> \d\d:\d\d:\d\d,\d\d\d\n/);
});
