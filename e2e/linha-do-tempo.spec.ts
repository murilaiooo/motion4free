import { expect, test, type Page } from '@playwright/test';

/**
 * Linha do tempo Edição (v0.17): dividir, apagar, copiar, recortar, colar, duplicar e mudar a ordem
 * dos pedaços, com desfazer. Usa o vídeo de teste com duas falas e uma pausa (dois pedaços).
 */
const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';

async function openVideo(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}

const seconds = async (page: Page) => Number((await page.getByTestId('out-duration').textContent())!.replace(' s', ''));
const segments = (page: Page) => page.locator('[data-testid^="tl-seg-"]:not([data-testid$="-start"]):not([data-testid$="-end"])');
const plan = (page: Page) => page.evaluate(() => (window as unknown as { __m4f: { plan: { segments: { srcStart: number; srcEnd: number }[] } } }).__m4f.plan);

test('dividir, apagar e desfazer na linha do tempo Edição', async ({ page }) => {
  await openVideo(page);
  await expect(page.getByTestId('timeline')).toHaveAttribute('data-view', 'edicao');
  await expect(segments(page)).toHaveCount(2);
  const before = await seconds(page);

  // clicar no meio do primeiro pedaço seleciona e leva a agulha até ali; S divide
  await page.getByTestId('tl-seg-0').click();
  await expect(page.getByTestId('segment-panel')).toBeVisible();
  await page.keyboard.press('s');
  await expect(segments(page)).toHaveCount(3);
  await expect.poll(() => seconds(page)).toBeCloseTo(before, 1);

  // Delete apaga o pedaço escolhido e o resto encosta
  await page.getByTestId('tl-seg-1').click();
  await page.keyboard.press('Delete');
  await expect(segments(page)).toHaveCount(2);
  await expect.poll(() => seconds(page)).toBeLessThan(before - 0.1);

  await page.getByTestId('undo').click();
  await expect(segments(page)).toHaveCount(3);
  await expect.poll(() => seconds(page)).toBeCloseTo(before, 1);
});

test('copiar, colar, recortar, duplicar e mudar a ordem de pedaços', async ({ page }) => {
  await openVideo(page);
  const before = await seconds(page);
  const first = (await plan(page)).segments[0]!;
  const len = first.srcEnd - first.srcStart;

  await page.getByTestId('tl-seg-0').click();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('End');
  await page.keyboard.press('Control+v');
  await expect(segments(page)).toHaveCount(3);
  await expect.poll(() => seconds(page)).toBeCloseTo(before + len, 1);
  // a cópia é o mesmo trecho da gravação, colado no fim
  expect((await plan(page)).segments.at(-1)).toEqual(first);

  // recortar tira e guarda; colar põe de volta na agulha
  await page.getByTestId('tl-cut').click();
  await expect(segments(page)).toHaveCount(2);
  await page.keyboard.press('Home');
  await page.getByTestId('tl-paste').click();
  await expect(segments(page)).toHaveCount(3);
  expect((await plan(page)).segments[0]).toEqual(first);

  // duplicar põe a cópia logo depois
  await page.getByTestId('tl-seg-2').click();
  await page.getByTestId('tl-duplicate').click();
  await expect(segments(page)).toHaveCount(4);

  // mudar a ordem pelo painel do pedaço
  const order = (await plan(page)).segments.map((s) => s.srcStart);
  // agora: primeiro, primeiro, segundo, segundo. O pedaço 2 vai para depois do 3.
  await page.getByTestId('tl-seg-1').click();
  await page.getByTestId('seg-move-right').click();
  await expect.poll(async () => (await plan(page)).segments.map((s) => s.srcStart)).toEqual([order[0], order[2], order[1], order[3]]);
  await expect(page.getByTestId('segment-panel')).toContainText('Pedaço 3 de 4');
});

test('legenda não copia sozinha: aviso com código próprio', async ({ page }) => {
  await openVideo(page);
  await page.getByTestId('tl-cap-c1').click();
  await expect(page.getByTestId('element-panel')).toBeVisible();
  await page.getByTestId('tl-copy').click();
  await expect(page.getByTestId('error-M4F-519')).toBeVisible();
});

test('a vista Original continua lá e a escolha fica guardada', async ({ page }) => {
  await openVideo(page);
  await page.getByTestId('tl-view-original').click();
  await expect(page.getByTestId('kept-segment')).toHaveCount(2);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId('timeline')).toHaveAttribute('data-view', 'original', { timeout: 60_000 });
  await page.getByTestId('tl-view-edit').click();
  await expect(page.getByTestId('timeline')).toHaveAttribute('data-view', 'edicao');
});

test('faixas maiores, atalhos de zoom e Esc tira a seleção (v0.25)', async ({ page }) => {
  await openVideo(page);
  const video = page.getByTestId('tl-seg-0');
  const small = (await video.boundingBox())!.height;
  await page.getByTestId('tl-size-g').click();
  await expect.poll(async () => (await video.boundingBox())!.height).toBeGreaterThan(small + 10);
  await expect(page.getByTestId('tl-waveform')).toBeVisible();

  // + aproxima, 0 volta a mostrar tudo
  await page.getByTestId('ruler').click();
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await expect(page.getByTestId('tl-zoom-fit')).toBeEnabled();
  await page.keyboard.press('0');
  await expect(page.getByTestId('tl-zoom-fit')).toBeDisabled();

  // a escolha da altura fica guardada
  expect(await page.evaluate(() => localStorage.getItem('m4f.track-size'))).toBe('g');

  await page.getByTestId('tl-seg-0').click();
  await expect(page.getByTestId('segment-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('segment-panel')).toBeHidden();
});
