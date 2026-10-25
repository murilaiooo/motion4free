import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';
import { tab } from './ui';

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';
const planOf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __m4f: { plan: { semanticCues?: { id: string; wordId: string; effect?: 'emphasis' | 'underline' | 'pulse'; offsetFrames: number; source: { text: string; start: number } }[] } } }).__m4f.plan);

test('issue #117: adiciona, reancora, desfaz/refaz e salva destaque no Brave', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?asr=rapida');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Legendas');
  await expect(page.getByTestId('semantic-cue-panel')).toBeVisible();
  const select = page.getByTestId('semantic-word-select');
  await expect(select.locator('option')).not.toHaveCount(0);
  const choices = await select.locator('option').evaluateAll(els => els.map(e => ({ id: (e as HTMLOptionElement).value, label: e.textContent })));
  const chosen = choices[0]!;
  const other = choices.find(o => o.id !== chosen.id);
  expect(other).toBeDefined();

  await page.getByTestId('semantic-add-current').click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.length).toBe(1);
  const id = (await planOf(page)).semanticCues![0]!.id;
  expect((await planOf(page)).semanticCues?.[0]?.wordId).toBe(chosen.id);
  await expect(page.getByTestId('semantic-cue-' + id)).toBeVisible();

  await select.selectOption(other!.id);
  await page.getByTestId('semantic-reanchor-' + id).click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.wordId).toBe(other!.id);
  await page.getByTestId('semantic-offset-' + id).fill('2');
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.offsetFrames).toBe(2);

  await page.getByTestId('undo').click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.offsetFrames).toBe(0);
  await page.getByTestId('redo').click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.offsetFrames).toBe(2);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Legendas');
  expect((await planOf(page)).semanticCues?.[0]).toMatchObject({ id, wordId: other!.id, offsetFrames: 2 });
  await page.getByTestId('semantic-remove-' + id).click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.length).toBe(0);
  await page.getByTestId('undo').click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.length).toBe(1);
});

test('issue #117: ausência de fala não sugere um destaque impossível', async ({ page }) => {
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Legendas');
  await expect(page.getByTestId('semantic-no-words')).toBeVisible();
  await expect(page.getByTestId('semantic-add-current')).toHaveCount(0);
});

test('issue #117: exporta MP4 com destaque ancorado; áudio e quadros decodificam', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto('/?asr=rapida');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Legendas');
  await page.getByTestId('semantic-add-current').click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.length).toBe(1);
  await page.getByTestId('semantic-effect-sw1').selectOption('pulse');
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.effect).toBe('pulse');
  const cue = (await planOf(page)).semanticCues![0]!;
  const timing = await page.evaluate(() => (window as unknown as { __m4f: { plan: { output: {fps:number}, semanticCues: { source:{start:number},offsetFrames:number}[] } } }).__m4f.plan);
  expect(timing.output.fps).toBe(30);
  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  await expect(download).toHaveAttribute('data-export-where', 'worker');
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const target = info.outputPath('palavra-destaque.mp4');
  await file.saveAs(target);
  const input = new Input({ source: new FilePathSource(target), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  expect(video?.displayWidth).toBe(1080);
  expect(video?.displayHeight).toBe(1920);
  expect(audio?.codec).toBe('aac');
  expect(await input.computeDuration()).toBeGreaterThan(2);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration,size:stream=index,codec_type,nb_frames', '-of', 'json', target], {encoding:'utf8'})) as {
    format: {duration:string,size:string}; streams: {codec_type:string;nb_frames?:string}[];
  };
  expect(Number(probe.format.size)).toBeGreaterThan(10_000);
  expect(probe.streams.map(s => s.codec_type)).toEqual(expect.arrayContaining(['video','audio']));
  const sourceAnchor = cue.source.start + cue.offsetFrames / timing.output.fps;
  // Decode the actual output frame close to the word and one near its end.
  // This is smoke + frame presence, not pixel-exact visual equivalence.
  for (const sec of [0.15, Math.max(0.1, Math.min(2.9, sourceAnchor))]) {
    const pixels = execFileSync('ffmpeg', ['-v','error','-ss',String(sec),'-i',target,'-frames:v','1',
      '-vf','scale=32:32:flags=area','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);
    expect(pixels.length).toBe(32 * 32 * 3);
  }
  console.log('ISSUE117_MP4 ' + JSON.stringify({ sourceAnchor, duration: probe.format.duration,
    bytes: probe.format.size, streams: probe.streams.map(s=>s.codec_type), cueId: cue.id,
    note: 'synthetic 3-second speech, actual worker MP4 and ffprobe/ffmpeg frames; semantic difference unit-tested through shared drawFrame' }));
});
test('issue #117: escolha de efeito, desfazer/refazer e persistência no Brave', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?asr=rapida');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Legendas');
  await page.getByTestId('semantic-add-current').click();
  const effect = page.getByTestId('semantic-effect-sw1');
  await expect(effect).toBeVisible();
  await expect(effect).toHaveValue('emphasis');
  await effect.selectOption('underline');
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.effect).toBe('underline');
  await effect.selectOption('pulse');
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.effect).toBe('pulse');
  await page.getByTestId('undo').click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.effect).toBe('underline');
  await page.getByTestId('redo').click();
  await expect.poll(async () => (await planOf(page)).semanticCues?.[0]?.effect).toBe('pulse');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Legendas');
  await expect(page.getByTestId('semantic-effect-sw1')).toHaveValue('pulse');
  expect((await planOf(page)).semanticCues?.[0]?.effect).toBe('pulse');
});
