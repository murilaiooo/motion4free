import { expect, test } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';

test('vídeo com pausas vira MP4 editado, mais curto, com áudio', async ({ page }, info) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/fala-com-pausas.webm');

  const outDuration = page.getByTestId('out-duration');
  await expect(outDuration).toBeVisible({ timeout: 60_000 });
  const shown = Number((await outDuration.textContent())!.replace(' s', ''));
  expect(shown).toBeGreaterThan(2.5);
  expect(shown).toBeLessThan(3.6);

  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const path = info.outputPath('saida.mp4');
  await file.saveAs(path);

  const input = new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  expect(video?.displayWidth).toBe(1080);
  expect(video?.displayHeight).toBe(1920);
  expect(audio?.codec).toBe('aac');
  expect(Math.abs((await input.computeDuration()) - shown)).toBeLessThan(0.2);
});
