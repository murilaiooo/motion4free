import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { tab } from './ui';

async function openMediaPanel(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Mídia');
}

const RED = 'e2e/fixtures/clip-red.webm';
const BLUE = 'e2e/fixtures/clip-blue.webm';

function probe(file: string): { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } } {
  return JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file,
  ], { encoding: 'utf8' }));
}

function colorAt(file: string, seconds: number): [number, number, number] {
  const data = execFileSync('ffmpeg', [
    '-v', 'error', '-ss', String(seconds), '-i', file,
    '-frames:v', '1', '-vf', 'scale=1:1:flags=area',
    '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1',
  ]);
  expect(data.length).toBe(3);
  return [data[0]!, data[1]!, data[2]!];
}

/** Frequência dominante aproximada pela taxa de cruzamentos de zero de uma senoide limpa. */
function pitchAt(file: string, seconds: number): number {
  const sampleRate = 8000;
  const duration = 0.25;
  const audio = execFileSync('ffmpeg', [
    '-v', 'error', '-ss', String(seconds), '-i', file, '-t', String(duration),
    '-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 's16le', 'pipe:1',
  ]);
  const samples = new Int16Array(audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.length));
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i-1]! <= 0 && samples[i]! > 0) crossings++;
  }
  return crossings / (samples.length / sampleRate);
}

test('dois vídeos reais: reordenar, exportar MP4, ffprobe verifica vídeo e áudio na ordem nova', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles([RED, BLUE]);
  await openMediaPanel(page);
  await expect(page.getByTestId('clip-c1')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('clip-c2').getByRole('button', { name: 'Mover para cima' }).click();
  const order = await page.locator('[data-testid^="clip-c"]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-testid')));
  expect(order).toEqual(['clip-c2', 'clip-c1']);

  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const downloadButton = page.getByTestId('download');
  await expect(downloadButton).toBeVisible({ timeout: 180_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'), downloadButton.click(),
  ]);
  const file = testInfo.outputPath('multi-actual.mp4');
  await download.saveAs(file);
  const meta = probe(file);
  const video = meta.streams.find(s => s.codec_type === 'video');
  expect(video).toBeDefined();
  expect(video!.width).toBe(1080);
  expect(video!.height).toBe(1920);
  expect(meta.streams.some(s => s.codec_type === 'audio')).toBe(true);
  const duration = Number(meta.format.duration);
  expect(duration).toBeGreaterThan(2.0);
  expect(duration).toBeLessThan(3.5);

  // O primeiro vídeo era azul/880 Hz; após reordenar deve continuar azul/880 Hz com som sincronizado.
  const first = colorAt(file, 0.35);
  const last = colorAt(file, duration - 0.55);
  expect(first[2]).toBeGreaterThan(first[0] + 35);
  expect(last[0]).toBeGreaterThan(last[2] + 35);
  expect(pitchAt(file, 0.35)).toBeGreaterThan(760);
  expect(pitchAt(file, 0.35)).toBeLessThan(1000);
  expect(pitchAt(file, duration - 0.55)).toBeGreaterThan(350);
  expect(pitchAt(file, duration - 0.55)).toBeLessThan(550);
});

test('editor permite acrescentar clipe mantendo o primeiro e desfazer a inclusão', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(RED);
  await openMediaPanel(page);
  await expect(page.getByTestId('clip-c1')).toBeVisible({ timeout: 90_000 });
  await page.locator('[data-testid="clip-list"] input[type=file]').setInputFiles(BLUE);
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('clip-c1')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('clip-c2')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByTestId('clip-c2')).toBeVisible();
});


test('salvar, reabrir, remover e desfazer conserva as fontes de todos os clipes', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles([RED, BLUE]);
  await openMediaPanel(page);
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('clip-c2').getByRole('button', { name: 'Mover para cima' }).click();
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await openMediaPanel(page);
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  expect(await page.locator('[data-testid^="clip-c"]').first().getAttribute('data-testid')).toBe('clip-c2');

  await page.getByTestId('clip-c1').getByRole('button', { name: 'Remover' }).click();
  await expect(page.getByTestId('clip-c1')).toHaveCount(0);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await openMediaPanel(page);
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('clip-c1')).toHaveCount(0);

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('clip-c1')).toBeVisible();
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await openMediaPanel(page);
  await expect(page.getByTestId('clip-c1')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('clip-c1')).toHaveCount(0);
  await expect(page.getByTestId('clip-c2')).toBeVisible();
});
