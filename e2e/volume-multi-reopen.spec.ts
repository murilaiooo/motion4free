import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { pickVideos } from './ui';

const source = ['e2e/fixtures/clip-red.webm', 'e2e/fixtures/clip-blue.webm'];
function rms(path: string, start: number, duration = 0.42) {
  const audio = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(start), '-i', path, '-t', String(duration), '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1']);
  const floats = new Float32Array(audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.length));
  let sum = 0;
  for (const value of floats) sum += value * value;
  return Math.sqrt(sum / floats.length);
}
function difference(a: number, b: number) { return Math.abs(20 * Math.log10(a / b)); }

test('equalização de dois clipes permanece igual no MP4 depois de salvar/reabrir (#53)', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/?asr=vazio');
  await pickVideos(page, source);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60000 });
  const exportMp4 = async (name: string) => {
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await expect(page.getByTestId('download')).toBeVisible({ timeout: 180000 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
    const path = info.outputPath(name);
    await download.saveAs(path);
    return path;
  };
  const before = await exportMp4('before-reopen.mp4');
  await page.reload();
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 90000 });
  const after = await exportMp4('after-reopen.mp4');
  for (const file of [before, after]) {
    expect(difference(rms(file, 0.35), rms(file, 1.78))).toBeLessThan(9.5);
  }
  expect(difference(rms(before, 0.35), rms(after, 0.35))).toBeLessThan(1.0);
  expect(difference(rms(before, 1.78), rms(after, 1.78))).toBeLessThan(1.0);
});
