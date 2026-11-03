import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const reference = 'Please open the window and look at the blue sky';

test('real English speech stays English with word timestamps (#171)', async ({ page }, info) => {
  test.skip(process.env.M4F_REAL_ASR !== '1', 'Requires FFmpeg flite and a local Whisper model download');
  test.setTimeout(480_000);
  const video = info.outputPath('synthetic-english.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=15',
    '-f', 'lavfi', '-i', 'flite=text=' + reference + ':voice=slt', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', video]);
  await page.goto('/?avaliar');
  for (const language of ['auto', 'en']) {
    await page.evaluate((speechLanguage) => localStorage.setItem('m4f-asr', JSON.stringify({ speechLanguage })), language);
    await page.reload();
    await page.getByTestId('eval-file').setInputFiles(video);
    await page.getByTestId('eval-model').selectOption('base-wasm');
    await page.getByTestId('eval-reference').fill(reference);
    await page.getByTestId('eval-run').click();
    const result = page.getByTestId('eval-result');
    await expect(result.or(page.locator('[data-testid^="error-M4F"]'))).toBeVisible({ timeout: 220_000 });
    await expect(result).toBeVisible();
    const timing = await result.locator('textarea').inputValue();
    await info.attach(language + '-timing', { body: timing, contentType: 'text/plain' });
    const rows = timing.trim().split('\n').map((line) => line.split('\t'));
    expect(rows.map((row) => row[2]).join(' ').toLowerCase().replace(/[^a-z ]/g, '')).toBe(reference.toLowerCase());
    for (const [start, end] of rows) {
      expect(Number(start)).toBeGreaterThanOrEqual(0);
      expect(Number(end)).toBeGreaterThan(Number(start));
    }
  }
});
