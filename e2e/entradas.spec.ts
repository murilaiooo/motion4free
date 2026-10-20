import { expect, test, type Page } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';

/** Entradas estranhas (v0.7): vídeo sem som, vídeo sem fala, vídeo de 1 segundo. */

async function open(page: Page, file: string, query = '') {
  await page.goto(`/${query}`);
  await page.getByTestId('file-input').setInputFiles(file);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}

async function exportFile(page: Page, path: string) {
  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  await file.saveAs(path);
  return new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
}

test('vídeo sem faixa de som: explica com código por que não há legendas e ainda exporta', async ({ page }, info) => {
  await open(page, 'e2e/fixtures/sem-audio.webm');
  await expect(page.getByTestId('warning-M4F-202')).toBeVisible();
  await expect(page.getByTestId('summary')).toContainText('0 legendas');
  const input = await exportFile(page, info.outputPath('sem-audio.mp4'));
  expect((await input.getPrimaryVideoTrack())?.displayHeight).toBe(1920);
  expect(await input.computeDuration()).toBeGreaterThan(1.8);
});

test('vídeo sem fala: aviso com código e sem legendas', async ({ page }) => {
  await open(page, 'e2e/fixtures/fala-com-pausas.webm', '?asr=vazio');
  await expect(page.getByTestId('warning-M4F-306')).toBeVisible();
  await expect(page.getByTestId('summary')).toContainText('0 legendas');
});

test('vídeo de 1 segundo: resumo no singular, pedido e exportação funcionam', async ({ page }, info) => {
  await open(page, 'e2e/fixtures/curto.webm');
  await expect(page.getByTestId('summary')).toContainText('1 trecho ·');
  await expect(page.getByTestId('summary')).toContainText('1 legenda ·');
  await page.getByTestId('brief-input').fill('gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos');
  await page.getByTestId('brief-apply').click();
  await expect(page.getByTestId('brief-summary')).toContainText('Apliquei');
  const input = await exportFile(page, info.outputPath('curto.mp4'));
  const d = await input.computeDuration();
  expect(d).toBeGreaterThan(0.8);
  expect(d).toBeLessThan(1.2);
});

for (const width of [1280, 390]) {
  test(`cartões dos estilos cabem na tela (${width} px), sem rolagem para o lado`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'e2e/fixtures/curto.webm');
    const grid = await page.locator('.style-grid').boundingBox();
    for (const id of ['pop', 'neon', 'editorial', 'documental']) {
      const card = await page.getByTestId(`style-${id}`).boundingBox();
      expect(card!.x + card!.width, id).toBeLessThanOrEqual(grid!.x + grid!.width + 1);
      // a amostra (nome do estilo e legenda de exemplo) fica dentro do cartão
      const swatch = await page.getByTestId(`style-${id}`).locator('.swatch').boundingBox();
      expect(swatch!.x + swatch!.width, `${id} amostra`).toBeLessThanOrEqual(card!.x + card!.width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
