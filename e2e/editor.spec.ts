import { expect, test, type Page } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';
import { editCaption, tab } from './ui';

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';

async function openVideo(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}

const seconds = async (page: Page) => Number((await page.getByTestId('out-duration').textContent())!.replace(' s', ''));

test('edita legenda, desfaz e refaz', async ({ page }) => {
  await openVideo(page);
  await tab(page, 'Legendas');
  await expect(page.getByTestId('caption-c2')).toHaveText('Primeira dica.');
  await editCaption(page, 'c2', 'Primeira dica de ouro!');
  await expect(page.getByTestId('caption-c2')).toHaveText('Primeira dica de ouro!');
  await expect(page.getByTestId('caption-chip-c2')).toHaveText('Primeira dica de ouro!');

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('caption-c2')).toHaveText('Primeira dica.');
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('caption-c2')).toHaveText('Primeira dica de ouro!');

  // legenda vazia é recusada com código próprio e nada muda
  await editCaption(page, 'c2', '   ');
  await expect(page.getByTestId('error-M4F-501')).toBeVisible();
  await expect(page.getByTestId('caption-c2')).toHaveText('Primeira dica de ouro!');

  // Esc cancela sem mudar
  await page.getByTestId('caption-c2').click();
  await page.getByTestId('caption-input-c2').fill('outra coisa');
  await page.getByTestId('caption-input-c2').press('Escape');
  await expect(page.getByTestId('caption-c2')).toHaveText('Primeira dica de ouro!');
});

test('restaura e ajusta um corte, com desfazer', async ({ page }) => {
  await openVideo(page);
  const before = await seconds(page);
  await expect(page.getByTestId('waveform')).toBeVisible();
  await expect(page.getByTestId('kept-segment')).toHaveCount(2);

  await page.getByTestId('cut-0').click();
  await expect(page.getByTestId('cut-panel')).toBeVisible();
  await page.getByTestId('cut-start-plus').click();
  await expect.poll(() => seconds(page)).toBeCloseTo(before + 0.1, 1);

  await page.getByTestId('restore-cut').click();
  await expect(page.getByTestId('kept-segment')).toHaveCount(1);
  const restored = await seconds(page);
  expect(restored).toBeGreaterThan(before + 1);

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('kept-segment')).toHaveCount(2);
  await page.getByTestId('undo').click();
  await expect.poll(() => seconds(page)).toBeCloseTo(before, 1);
});

test('player toca a edição e o tempo avança', async ({ page }) => {
  await openVideo(page);
  await expect(page.getByTestId('player-time')).toContainText('0,00 s /');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveText('Pausar');
  await expect.poll(async () => Number((await page.getByTestId('player-time').textContent())!.split(' s')[0]!.replace(',', '.')), { timeout: 10_000 }).toBeGreaterThan(0.5);
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveText('Assistir');
  // o quadro desenhado não é preto (vídeo + legenda via drawFrame)
  const lit = await page.getByTestId('player-canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 400) sum += d[i]! + d[i + 1]! + d[i + 2]!;
    return sum;
  });
  expect(lit).toBeGreaterThan(0);
});

test('projeto volta depois de recarregar a página', async ({ page }) => {
  await openVideo(page);
  await editCaption(page, 'c1', 'Três dicas salvas.');
  await page.getByTestId('cut-1').click();
  await page.getByTestId('restore-cut').click();
  const edited = await seconds(page);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByTestId('caption-c1')).toHaveText('Três dicas salvas.', { timeout: 60_000 });
  expect(await seconds(page)).toBeCloseTo(edited, 1);
  // o histórico também volta: desfazer recupera o corte
  await page.getByTestId('undo').click();
  await expect.poll(() => seconds(page)).toBeLessThan(edited - 0.5);
});

test('sem a cópia do vídeo, pede o arquivo de novo (M4F-604) e continua o projeto', async ({ page }) => {
  await openVideo(page);
  await editCaption(page, 'c2', 'Dica reaberta.');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('motion4free-projeto');
    await dir.removeEntry('video.bin');
  });

  await page.reload();
  await expect(page.getByTestId('warning-M4F-604')).toBeVisible({ timeout: 30_000 });
  // arquivo que não é o vídeo é recusado e o aviso continua
  await page.getByTestId('file-input').setInputFiles({ name: 'outro.webm', mimeType: 'video/webm', buffer: Buffer.from('nao') });
  await expect(page.getByTestId('error-M4F-101')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('caption-c2')).toHaveText('Dica reaberta.', { timeout: 60_000 });
  await expect(page.getByTestId('warning-M4F-604')).toHaveCount(0);
});

test('exporta a versão editada (corte restaurado) num MP4 válido', async ({ page }, info) => {
  await openVideo(page);
  await page.getByTestId('cut-0').click();
  await page.getByTestId('restore-cut').click();
  const shown = await seconds(page);
  expect(shown).toBeGreaterThan(4);

  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  await expect(download).toHaveAttribute('data-export-where', 'worker');
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const path = info.outputPath('editado.mp4');
  await file.saveAs(path);

  const input = new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
  expect((await input.getPrimaryVideoTrack())?.displayHeight).toBe(1920);
  expect((await input.getPrimaryAudioTrack())?.codec).toBe('aac');
  expect(Math.abs((await input.computeDuration()) - shown)).toBeLessThan(0.2);
});
