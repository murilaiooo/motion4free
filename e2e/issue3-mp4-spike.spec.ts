import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { editCaption } from './ui';

interface Probe {
  streams: Array<{ codec_type: string; codec_name: string; width?: number; height?: number; avg_frame_rate?: string; sample_rate?: string }>;
  format: { duration: string; size: string; bit_rate?: string };
}

function fps(rate: string): number {
  const [n, d] = rate.split('/').map(Number);
  return n! / (d || 1);
}
function probe(file: string): Probe {
  return JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries',
    'stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate:format=duration,size,bit_rate',
    '-of', 'json', file,
  ], { encoding: 'utf8' })) as Probe;
}

/** Real encoded input and output, but synthetic speech content; no third-party service. */
test('issue #3: corta, revisa legenda e exporta MP4 com codec/FPS/áudio; mede tempo e heap do Brave', async ({ page }, info) => {
  test.setTimeout(240_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async (): Promise<number | null> => {
    const result = await cdp.send('Performance.getMetrics');
    const entry = result.metrics.find(metric => metric.name === 'JSHeapUsedSize');
    return entry?.value ?? null; // JS heap only, not full RAM, GPU or peak encoder memory
  };

  await page.goto('/');
  const beforeImport = Date.now();
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  const importMs = Date.now() - beforeImport;

  await editCaption(page, 'c2', 'Primeira dica confirmada no arquivo!');
  await expect(page.getByTestId('caption-c2')).toHaveText('Primeira dica confirmada no arquivo!');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });

  const beforeHeap = await heap();
  const beforeExport = Date.now();
  await page.getByTestId('export').click();
  await expect(page.getByTestId('download')).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId('download')).toHaveAttribute('data-export-where', 'worker');
  const exportMs = Date.now() - beforeExport;
  const afterHeap = await heap();

  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByTestId('download').click(),
  ]);
  const output = info.outputPath('issue3-encoded.mp4');
  await download.saveAs(output);
  const data = probe(output);
  const video = data.streams.find(stream => stream.codec_type === 'video');
  const audio = data.streams.find(stream => stream.codec_type === 'audio');
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  expect(video).toBeDefined();
  expect(video).toMatchObject({ width: 1080, height: 1920 });
  expect(['h264', 'vp9', 'av1']).toContain(video!.codec_name);
  expect(fps(video!.avg_frame_rate ?? '')).toBeGreaterThanOrEqual(24);
  expect(fps(video!.avg_frame_rate ?? '')).toBeLessThanOrEqual(60);
  expect(audio?.codec_name).toBe('aac');
  expect(Number(data.format.duration)).toBeGreaterThan(2.5);
  expect(Number(data.format.duration)).toBeLessThan(3.7);
  expect(statSync(output).size).toBeGreaterThan(10_000);
  expect(Number(data.format.size)).toBe(statSync(output).size);

  const pixel = execFileSync('ffmpeg', [
    '-v', 'error', '-ss', '1', '-i', output, '-frames:v', '1',
    '-vf', 'scale=1:1:flags=area', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1',
  ]);
  expect(pixel).toHaveLength(3);
  expect([...pixel].reduce((a, b) => a + b, 0)).toBeGreaterThan(20);

  const evidence = {
    browser: 'Chromium-compatible (specified by CHROMIUM_PATH)',
    importedFixture: 'fala-com-pausas.webm (synthetic but encoded)',
    output: 'issue3-encoded.mp4',
    codecs: { video: video!.codec_name, audio: audio!.codec_name },
    resolution: [video!.width, video!.height],
    averageFps: fps(video!.avg_frame_rate ?? ''),
    durationSec: Number(data.format.duration),
    outputBytes: statSync(output).size,
    importMs,
    exportMs,
    jsHeapUsedBeforeExport: beforeHeap,
    jsHeapUsedAfterExport: afterHeap,
    limitation: 'heap snapshot is not peak RSS or GPU memory; fixture is synthetic; no human sync/long-video benchmark',
  };
  console.log('ISSUE3_MP4_EVIDENCE ' + JSON.stringify(evidence));
  await info.attach('mp4-spike-evidence.json', { body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: 'application/json' });
  await cdp.detach();
});
