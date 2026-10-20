import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const RED = 'e2e/fixtures/clip-red.webm';
const BLUE = 'e2e/fixtures/clip-blue.webm';
const MUTE = 'e2e/fixtures/sem-audio.webm';

function metadata(file: string): { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } } {
  return JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file,
  ], { encoding: 'utf8' }));
}

async function downloadMp4(page: Page, output: string): Promise<string> {
  await page.getByTestId('export').click();
  const link = page.getByTestId('download');
  await expect(link).toBeVisible({ timeout: 180_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  await download.saveAs(output);
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  return output;
}

for (const [format, width, height] of [
  ['vertical', 1080, 1920], ['retrato', 1080, 1350],
  ['quadrado', 1080, 1080], ['horizontal', 1920, 1080],
] as const) {
  test(`QA real: clipes horizontal+vertical em formato ${format} (${width}×${height}), com áudio no MP4`, async ({ page }, info) => {
    test.setTimeout(240_000);
    await page.goto('/?asr=vazio');
    await page.getByTestId('file-input').setInputFiles([RED, BLUE]);
    await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
    await page.getByTestId('format-select').selectOption(format);
    await expect(page.getByTestId('format-select')).toHaveValue(format);
    const out = await downloadMp4(page, info.outputPath(`qa-${format}.mp4`));
    const m = metadata(out);
    expect(m.streams.find(s => s.codec_type === 'video')).toMatchObject({ width, height });
    expect(m.streams.some(s => s.codec_type === 'audio')).toBe(true);
    expect(Number(m.format.duration)).toBeGreaterThan(2);
    expect(Number(m.format.duration)).toBeLessThan(3.5);
  });
}

test('QA real: arquivo sem áudio exporta vídeo válido sem adicionar trilha fictícia', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(MUTE);
  await expect(page.getByTestId('clip-c1')).toBeVisible({ timeout: 90_000 });
  const out = await downloadMp4(page, info.outputPath('qa-no-audio.mp4'));
  const m = metadata(out);
  expect(m.streams.find(s => s.codec_type === 'video')).toMatchObject({ width: 1080, height: 1920 });
  expect(m.streams.some(s => s.codec_type === 'audio')).toBe(false);
});

test('QA real: primeiro vídeo removido preserva segundo após fechar e reabrir, exporta imagem+som corretos', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles([RED, BLUE]);
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('clip-c1').getByRole('button', { name: 'Remover' }).click();
  await expect(page.getByTestId('clip-c1')).toHaveCount(0);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 90_000 });
  await page.reload();
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('clip-c1')).toHaveCount(0);
  const out = await downloadMp4(page, info.outputPath('qa-only-c2.mp4'));
  const m = metadata(out);
  expect(Number(m.format.duration)).toBeGreaterThan(0.7);
  expect(Number(m.format.duration)).toBeLessThan(2);
  expect(m.streams.some(s => s.codec_type === 'audio')).toBe(true);
  const pixel = execFileSync('ffmpeg', ['-v','error','-ss','0.3','-i',out,'-frames:v','1','-vf','scale=1:1:flags=area','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);
  expect(pixel.length).toBe(3);
  expect(pixel[2]!).toBeGreaterThan(pixel[0]! + 35);
});

test('QA: trocas de formato são guardadas, sobrevivem ao reiniciar e ao desfazer', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(RED);
  await expect(page.getByTestId('format-select')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('format-select').selectOption('horizontal');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 90_000 });
  await page.reload();
  await expect(page.getByTestId('format-select')).toHaveValue('horizontal', { timeout: 90_000 });
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('format-select')).toHaveValue('vertical');
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('format-select')).toHaveValue('horizontal');
});


test('QA: um arquivo corrompido entre arquivos válidos não cancela o projeto nem altera a mídia original', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?asr=vazio');
  const invalid = { name: 'defeituoso.mp4', mimeType: 'video/mp4', buffer: Buffer.from('isto nao e um video') };
  await page.getByTestId('file-input').setInputFiles([
    invalid,
    { name: 'clip-red.webm', mimeType: 'video/webm', buffer: readFileSync(RED) },
    { name: 'clip-blue.webm', mimeType: 'video/webm', buffer: readFileSync(BLUE) },
  ]);
  await expect(page.getByTestId('clip-c1')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('clip-c2')).toBeVisible();
  await expect(page.getByTestId('clip-c3')).toHaveCount(0);
  await expect(page.getByTestId('warning-M4F-108')).toBeVisible();
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await expect(page.getByTestId('clip-c1')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('clip-c2')).toBeVisible();
  await expect(page.getByTestId('warning-M4F-615')).toHaveCount(0);
});
