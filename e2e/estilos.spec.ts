import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';
const STYLES = ['pop', 'neon', 'editorial', 'documental'] as const;
const SHOTS = ['abertura', 'numero', 'lista', 'pergunta', 'nome', 'legenda', 'chamada'] as const;

async function openVideo(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}

/** Soma simples dos pixels do canvas do player (muda quando o desenho muda). */
const canvasHash = (page: Page) =>
  page.getByTestId('player-canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 16) h = (h * 31 + d[i]! + d[i + 1]! * 3 + d[i + 2]! * 7) % 1_000_000_007;
    return h;
  });

test('troca de estilo muda a prévia, entra no desfazer e vale para o MP4', async ({ page }, info) => {
  await openVideo(page);
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('scene-summary')).toContainText('número grande');
  // fontes do estilo carregadas na página
  await expect.poll(() => page.evaluate(() => document.fonts.check('900 40px "Montserrat"') && document.fonts.check('400 40px "Anton"'))).toBe(true);

  // quadro com o número grande no início do vídeo
  await page.getByTestId('player-canvas').scrollIntoViewIfNeeded();
  await expect.poll(() => canvasHash(page)).not.toBe(0);
  await page.waitForTimeout(300);
  const popHash = await canvasHash(page);

  await page.getByTestId('style-documental').click();
  await expect(page.getByTestId('style-documental')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => document.fonts.check('700 40px "IBM Plex Sans Condensed"'))).toBe(true);
  await expect.poll(() => canvasHash(page)).not.toBe(popHash);

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('style-documental')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('style-editorial').click();
  await expect(page.getByTestId('style-editorial')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  await expect(download).toHaveAttribute('data-style', 'Editorial');
  await expect(download).toHaveAttribute('data-export-where', 'worker');
  await expect(page.getByTestId('warning-M4F-801')).toHaveCount(0);
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(file.suggestedFilename()).toContain('-editorial-');
  const path = info.outputPath('editorial.mp4');
  await file.saveAs(path);
  const input = new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  expect(video?.displayWidth).toBe(1080);
  expect(video?.displayHeight).toBe(1920);
  expect((await input.getPrimaryAudioTrack())?.codec).toBe('aac');
  expect(await input.computeDuration()).toBeGreaterThan(2);

  // o estilo escolhido fica salvo com o projeto
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId('style-editorial')).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 });
});

test.describe('galeria de estilos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?galeria');
    await expect(page.getByTestId('gallery')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  });

  test('desenho determinístico: o mesmo instante dá o mesmo quadro, em qualquer ordem', async ({ page }) => {
    const same = await page.evaluate(() => {
      const g = window.m4fGallery!;
      const results: boolean[] = [];
      for (const s of ['pop', 'neon', 'editorial', 'documental']) {
        const first = g.render(s, 8.3, 270);
        for (const t of [26.9, 0.4, 12.0, 4.4, 22.0]) g.render(s, t, 270);
        results.push(g.render(s, 8.3, 270) === first);
      }
      return results;
    });
    expect(same).toEqual([true, true, true, true]);
  });

  test('os estilos desenham quadros diferentes entre si', async ({ page }) => {
    for (const t of [1.3, 4.6, 12.2, 22.1]) {
      const frames = await page.evaluate((tt) => ['pop', 'neon', 'editorial', 'documental'].map((s) => window.m4fGallery!.render(s, tt, 270)), t);
      expect(new Set(frames).size).toBe(4);
    }
  });

  for (const style of STYLES) {
    test(`quadros de referência · ${style}`, async ({ page }) => {
      for (const shot of SHOTS) {
        // Guarda grosseira (cena sumiu, trocou de lugar ou de estilo): as referências foram geradas no
        // Chromium 1194 e a CI usa o 1248, cuja métrica de fonte muda a largura das caixas de texto
        // (até 9% dos pixels no título documental). A regressão fina fica nos testes de unidade das cenas.
        await expect(page.getByTestId(`gal-${style}-${shot}`)).toHaveScreenshot(`${style}-${shot}.png`, { maxDiffPixelRatio: 0.12, threshold: 0.35 });
      }
    });
  }

  // SAVE_FASE3=1: grava as imagens de comparação em docs/assets/fase3 (para o responsável ver)
  test('imagens de comparação', async ({ page }) => {
    test.skip(!process.env.SAVE_FASE3, 'só quando SAVE_FASE3=1');
    mkdirSync('docs/assets/fase3', { recursive: true });
    for (const style of STYLES) {
      const url = await page.evaluate((s) => window.m4fGallery!.strip(s), style);
      writeFileSync(`docs/assets/fase3/${style}.png`, Buffer.from(url.split(',')[1]!, 'base64'));
    }
  });
});
