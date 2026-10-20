import { expect, test, type Page } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';

interface Range {
  id: string;
  out: { start: number; end: number };
  locked: unknown;
}
interface Scene {
  id: string;
  kind: string;
  start: number;
  end: number;
}
interface Plan {
  style: { id: string; palette: { accent: string } };
  segments: unknown[];
  captions: { id: string; start: number; end: number }[];
  scenes: Scene[];
  ranges: Range[];
}

async function openVideo(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}

const plan = (page: Page) => page.evaluate(() => (window as unknown as { __m4f: { plan: Plan } }).__m4f.plan);
const inside = (s: { kind: string; start: number; end: number }, r: { start: number; end: number }) => s.kind !== 'progress-bar' && s.start >= r.start - 1e-6 && s.end <= r.end + 1e-6;
const touching = (p: Plan, r: { start: number; end: number }) => ({
  scenes: p.scenes.filter((s) => s.kind !== 'progress-bar' && s.start < r.end && s.end > r.start),
  captions: p.captions.filter((c) => c.start < r.end && c.end > r.start),
});

/** Seleciona um pedaço pelos campos de início e fim (tempo do vídeo editado). */
async function select(page: Page, start: number, end: number) {
  await page.getByTestId('range-new').click();
  await expect(page.getByTestId('range-panel')).toBeVisible();
  await page.getByTestId('range-start').fill(String(start));
  await page.getByTestId('range-start').press('Enter');
  await page.getByTestId('range-end').fill(String(end));
  await page.getByTestId('range-end').press('Enter');
  await expect(page.getByTestId('range-end-label')).toHaveText(`${end.toFixed(2).replace('.', ',')} s`);
}

async function askRange(page: Page, text: string) {
  await page.getByTestId('range-input').fill(text);
  await page.getByTestId('range-apply').click();
}

test('pedido num trecho muda só o trecho; o que mudou aparece; antes/depois e desfazer', async ({ page }) => {
  await openVideo(page);
  const before = await plan(page);
  await select(page, 1.6, 2.9);
  await expect(page.getByTestId('range-selection')).toBeVisible();

  await askRange(page, 'xyz aqui');
  await expect(page.getByTestId('warning-M4F-1010')).toBeVisible();

  await askRange(page, 'sem animação aqui');
  await expect(page.getByTestId('range-r1')).toBeVisible();
  await expect(page.getByTestId('range-summary')).toContainText('Sem animação');
  const after = await plan(page);
  const r = after.ranges[0]!;
  expect(r.out.start).toBeCloseTo(1.6, 2);
  expect(r.out.end).toBeCloseTo(2.9, 2);
  // fora do trecho, nada muda: cortes, legendas e cenas
  expect(after.segments).toEqual(before.segments);
  expect(after.captions).toEqual(before.captions);
  expect(after.scenes.filter((s) => !inside(s, r.out))).toEqual(before.scenes.filter((s) => !inside(s, r.out)));
  expect(after.scenes.filter((s) => inside(s, r.out))).toEqual([]);

  // o que mudou + antes/depois
  await expect(page.getByTestId('changes-list')).toContainText('Trecho novo de 1,6 s a 2,9 s');
  await page.getByTestId('view-before').click();
  await expect(page.getByTestId('view-before')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('view-after').click();

  // destaque: volta a ter animação só dentro do trecho
  await askRange(page, 'destaque isso');
  const accented = await plan(page);
  expect(accented.scenes.filter((s) => inside(s, r.out)).length).toBeGreaterThan(0);
  expect(accented.scenes.filter((s) => !inside(s, r.out))).toEqual(before.scenes.filter((s) => !inside(s, r.out)));

  // pedaço encostando no trecho é recusado com código
  await page.getByTestId('range-close').click();
  await select(page, 2, 2.8);
  await askRange(page, 'mais calmo aqui');
  await expect(page.getByTestId('error-M4F-506')).toBeVisible();
  await page.getByTestId('range-close').click();

  await page.getByTestId('undo').click();
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('range-r1')).toHaveCount(0);
  expect((await plan(page)).scenes).toEqual(before.scenes);
});

test('trava o trecho, troca o estilo e o trecho não muda; versões; recarrega; exporta MP4', async ({ page }, info) => {
  await openVideo(page);
  await select(page, 1.6, 2.9);
  await askRange(page, 'destaque isso');
  await page.getByTestId('range-lock').click();
  await expect(page.getByTestId('range-summary')).toContainText('Travado');
  const locked = await plan(page);
  const out = locked.ranges[0]!.out;
  const snap = touching(locked, out);
  expect(snap.captions.length).toBeGreaterThan(0);

  await page.getByTestId('version-name').fill('pop travado');
  await page.getByTestId('version-save').click();
  await expect(page.getByTestId('version-v1')).toContainText('pop travado');

  await page.getByTestId('style-editorial').click();
  await expect(page.getByTestId('style-editorial')).toHaveAttribute('aria-pressed', 'true');
  const restyled = await plan(page);
  expect(restyled.style.id).toBe('editorial');
  expect(touching(restyled, out)).toEqual(snap);

  // pedido e legenda dentro da trava são recusados com código
  await page.getByTestId('range-r1').click();
  await askRange(page, 'mais calmo aqui');
  await expect(page.getByTestId('error-M4F-504')).toBeVisible();
  const cap = snap.captions[0]!.id;
  await page.getByTestId(`caption-input-${cap}`).fill('outro texto');
  await page.getByTestId(`caption-input-${cap}`).press('Enter');
  await expect(page.getByTestId('error-M4F-504').first()).toBeVisible();

  // restaurar a versão volta ao Pop (e entra no desfazer)
  await page.getByTestId('version-restore-v1').click();
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('style-editorial')).toHaveAttribute('aria-pressed', 'true');

  // tudo volta depois de recarregar
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId('range-r1')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('version-v1')).toContainText('pop travado');
  const reloaded = await plan(page);
  expect(reloaded.style.id).toBe('editorial');
  expect(touching(reloaded, out)).toEqual(snap);

  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const path = info.outputPath('trechos.mp4');
  await file.saveAs(path);
  const input = new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  expect(video?.displayWidth).toBe(1080);
  expect(video?.displayHeight).toBe(1920);
  expect((await input.getPrimaryAudioTrack())?.codec).toBe('aac');
  expect(await input.computeDuration()).toBeGreaterThan(2.5);
});

/** BMP 24 bits 2×2 (vermelho e azul), montado à mão: o navegador lê sem biblioteca. */
function bmp(): Buffer {
  const w = 2;
  const h = 2;
  const row = 8; // 2 px × 3 bytes, alinhado a 4
  const size = 54 + row * h;
  const b = Buffer.alloc(size);
  b.write('BM', 0);
  b.writeUInt32LE(size, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18);
  b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  b.writeUInt32LE(row * h, 34);
  const px = [
    [200, 20, 40],
    [200, 20, 40],
    [30, 40, 210],
    [200, 20, 40],
  ];
  px.forEach(([r, g, bl], i) => {
    const o = 54 + Math.floor(i / 2) * row + (i % 2) * 3;
    b[o] = bl!;
    b[o + 1] = g!;
    b[o + 2] = r!;
  });
  return b;
}

test('cores de uma imagem: aplica com contraste, desfaz e recusa arquivo que não é imagem', async ({ page }) => {
  await openVideo(page);
  const accent = (await plan(page)).style.palette.accent;
  await page.getByTestId('reference-input').setInputFiles({ name: 'logo.bmp', mimeType: 'image/bmp', buffer: bmp() });
  await expect(page.getByTestId('reference-colors')).toBeVisible();
  await expect.poll(async () => (await plan(page)).style.palette.accent).not.toBe(accent);
  await expect(page.getByTestId('changes-list')).toContainText('Cores tiradas da sua imagem');
  await page.getByTestId('reference-clear').click();
  await expect.poll(async () => (await plan(page)).style.palette.accent).toBe(accent);

  await page.getByTestId('reference-input').setInputFiles({ name: 'nada.png', mimeType: 'image/png', buffer: Buffer.from('isto não é imagem') });
  await expect(page.getByTestId('error-M4F-803')).toBeVisible();
});
