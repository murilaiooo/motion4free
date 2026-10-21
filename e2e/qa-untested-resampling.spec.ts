import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const STEREO = 'e2e/fixtures/qa-44100-stereo.webm';
const MONO = 'e2e/fixtures/qa-48000-mono.webm';

function audioInfo(path: string): { sample_rate: string; channels: number } {
  const data = JSON.parse(execFileSync('ffprobe', ['-v','error','-select_streams','a:0',
    '-show_entries','stream=sample_rate,channels','-of','json',path], { encoding:'utf8' }));
  return data.streams[0];
}

function rmsPerChannel(path: string, from: number, duration = .30): [number, number] {
  const data = execFileSync('ffmpeg', ['-v','error','-ss',String(from),'-i',path,'-t',String(duration),
    '-vn','-ac','2','-ar','16000','-c:a','pcm_s16le','-f','s16le','pipe:1']);
  expect(data.length % 4).toBe(0);
  let a = 0, b = 0, n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const l = data.readInt16LE(i)/32768, r = data.readInt16LE(i+2)/32768;
    a += l*l; b += r*r; n++;
  }
  return [Math.sqrt(a / n), Math.sqrt(b / n)];
}

test('pipeline real nunca testado: decodifica Vorbis estéreo 44,1k + Opus mono 48k e preserva canais', async ({ page }, info) => {
  test.setTimeout(230_000);
  expect(audioInfo(STEREO)).toMatchObject({ sample_rate:'44100', channels:2 });
  expect(audioInfo(MONO)).toMatchObject({ sample_rate:'48000', channels:1 });
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles([STEREO, MONO]);
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('export').click();
  const control = page.getByTestId('download');
  await expect(control).toBeVisible({ timeout: 130_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), control.click()]);
  const out = info.outputPath('mixed-44100-stereo-48000-mono.mp4');
  await download.saveAs(out);
  expect(audioInfo(out).channels).toBe(2);
  const [firstL, firstR] = rmsPerChannel(out, .3);
  const [secondL, secondR] = rmsPerChannel(out, 1.65);
  // O conteúdo estéreo mantém diferença de amplitude; o segundo clipe mono deve soar no centro.
  expect(firstL).toBeGreaterThan(firstR * 1.8);
  expect(secondL).toBeGreaterThan(.01);
  expect(secondR).toBeGreaterThan(.01);
  expect(Math.abs(secondL-secondR)).toBeLessThan(.008);
});
