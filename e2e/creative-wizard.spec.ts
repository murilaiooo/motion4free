import { expect, test, type Page } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';
import { pickTheme } from './ui';

const VIDEO = 'e2e/fixtures/fala-com-pausas.webm';

/** v0.32: os vídeos vêm primeiro; as perguntas aparecem enquanto o app prepara. */
async function startWithVideo(page: Page) {
  await page.getByTestId('file-input').setInputFiles(VIDEO);
  await expect(page.getByTestId('setup-shell')).toBeVisible();
}

test('videos first: questions appear while the videos are prepared, with large cards and no form', async ({ page }, info) => {
  await page.goto('/');
  await startWithVideo(page);
  await expect(page.getByTestId('setup-prep')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Onde você vai publicar?' })).toBeVisible();
  const content = page.getByRole('region', { name: 'Configuração do vídeo' });
  await expect(content.locator('input:visible, select:visible, textarea:visible')).toHaveCount(0);
  const youtube = content.getByRole('button', { name: 'YouTube', exact: true });
  const card = await youtube.boundingBox();
  expect(card!.height).toBeGreaterThanOrEqual(100);
  expect(await youtube.locator('strong').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(20);
  await youtube.click();
  await expect(youtube).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('01-destino.png'), fullPage: true, animations: 'disabled' });
  await page.getByTestId('setup-next').click();
  await expect(page.getByRole('heading', { name: 'Qual visual você prefere?' })).toBeFocused();
  await content.getByRole('button', { name: 'Documental', exact: true }).click();
  await expect(content.locator('canvas[data-ready="1"]')).toHaveCount(6);
  await page.screenshot({ path: info.outputPath('02-visual.png'), fullPage: true, animations: 'disabled' });
  await page.getByTestId('setup-next').click();
  await content.getByRole('button', { name: 'Discreta', exact: true }).click();
  await page.getByTestId('setup-next').click();
  await expect(page.getByRole('heading', { name: 'Quanto cortar?' })).toBeFocused();
  await content.getByRole('button', { name: 'Sem cortes', exact: true }).click();
  await expect(content).toContainText('A voz não é acelerada');
  await content.getByRole('button', { name: '60 segundos', exact: true }).click();
  await page.getByTestId('setup-next').click();
  // a preparação termina enquanto o usuário responde: o botão final diz que o vídeo está pronto
  await expect(page.getByTestId('setup-prep')).toContainText('pronto');
  await expect(page.getByTestId('setup-review')).toContainText('Sem cortes');
  await expect(page.getByTestId('setup-review')).toContainText('60 segundos');
  await expect(page.getByTestId('setup-review')).toContainText('Documental');
  await expect(page.getByTestId('setup-review')).toContainText('Discreta');
  await expect(content.locator('input:visible, select:visible, textarea:visible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Alterar cortes', exact: true }).click();
  await expect(content.getByRole('button', { name: '60 segundos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await content.getByRole('button', { name: 'Vídeo completo', exact: true }).click();
  await page.getByRole('button', { name: 'Pronto', exact: true }).click();
  await page.screenshot({ path: info.outputPath('03-pronto.png'), fullPage: true, animations: 'disabled' });
  await expect(page.getByTestId('setup-complete')).toHaveText(/Ver meu vídeo/);
  await page.getByTestId('setup-complete').click();
  await expect(page.getByTestId('draft-review')).toBeVisible({ timeout: 60_000 });
  const plan = await page.evaluate(() => (window as any).__m4f.plan);
  expect(plan.output).toMatchObject({ width: 1920, height: 1080 });
  expect(plan.brief.production).toMatchObject({ cutPolicy: 'preserve', durationSec: null, captionStyle: 'minimal', preset: 'documental' });
  const source = new Input({ source: new FilePathSource(VIDEO), formats: ALL_FORMATS });
  const sourceDuration = await source.computeDuration();
  source.dispose();
  expect(plan.segments).toEqual([{ srcStart: 0, srcEnd: sourceDuration }]);
  expect(plan.style.captions.activeScale).toBe(1);
});

test('returning users only confirm: the next video starts at "use the same choices"', async ({ page }) => {
  await page.goto('/');
  await startWithVideo(page);
  await page.getByRole('button', { name: 'TikTok', exact: true }).click();
  await page.getByTestId('setup-skip').click();
  await expect(page.getByTestId('draft-review')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('menu-close').click();
  await startWithVideo(page);
  await expect(page.getByRole('heading', { name: 'Usar as mesmas escolhas da última vez?' })).toBeVisible();
  await expect(page.getByTestId('setup-review')).toContainText('TikTok');
  await page.getByTestId('setup-complete').click();
  await expect(page.getByTestId('draft-review')).toBeVisible({ timeout: 60_000 });
});

test('leaving the questions discards the preparation and keeps the answers', async ({ page }) => {
  await page.goto('/');
  await startWithVideo(page);
  await page.getByRole('button', { name: 'TikTok', exact: true }).click();
  await page.getByTestId('setup-back').click();
  await expect(page.getByTestId('path-edit')).toBeVisible();
  await expect(page.getByTestId('processing')).toHaveCount(0);
  await startWithVideo(page);
  await expect(page.getByRole('button', { name: 'TikTok', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('mobile and keyboard choices persist, custom settings are not overwritten by navigation', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await startWithVideo(page);
  await page.getByRole('button', { name: 'TikTok', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Cortes', exact: true }).click();
  await page.getByRole('button', { name: 'Dinâmico', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.screenshot({ path: info.outputPath('mobile-editing.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Destino', exact: true }).click();
  await expect(page.getByRole('button', { name: 'TikTok', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await startWithVideo(page);
  await expect(page.getByRole('button', { name: 'TikTok', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Cortes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dinâmico', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Pronto', exact: true }).click();
  await page.getByText('Ajustes opcionais', { exact: true }).click();
  await page.getByText('Movimento e transições', { exact: true }).click();
  await page.getByRole('button', { name: 'Sem movimento', exact: true }).click();
  await page.getByRole('button', { name: 'Cortes', exact: true }).click();
  await expect(page.getByTestId('setup-custom-mode')).toBeVisible();
  await page.getByTestId('setup-next').click();
  await page.getByText('Ajustes opcionais', { exact: true }).click();
  await page.getByText('Movimento e transições', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sem movimento', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-adjustments.png'), fullPage: true, animations: 'disabled' });
  await page.getByTestId('setup-complete').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('m4f.creative-setup.v1')!));
  expect(saved).toMatchObject({ platform: 'tiktok', pace: 'rapido', cutPolicy: 'balanced', motion: 0 });
});

test('custom output survives reselecting its platform and an invalid optional call remains recoverable', async ({ page }, info) => {
  await page.goto('/');
  await pickTheme(page, 'light');
  await startWithVideo(page);
  await page.getByRole('button', { name: 'Outro destino', exact: true }).click();
  await page.getByRole('button', { name: 'Quadrado', exact: true }).click();
  await page.getByRole('button', { name: 'Outro destino', exact: true }).click();
  await expect(page.getByTestId('setup-output-format')).toContainText('Quadrado · 1:1');
  await page.screenshot({ path: info.outputPath('light-destination.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Pronto', exact: true }).click();
  await page.getByText('Ajustes opcionais', { exact: true }).click();
  await page.getByText('Abertura e chamada final', { exact: true }).click();
  await page.getByRole('button', { name: 'Escrever outra', exact: true }).click();
  await page.getByLabel('Texto da chamada final', { exact: false }).fill('A');
  await page.reload();
  await startWithVideo(page);
  await page.getByTestId('setup-skip').click();
  await expect(page.getByTestId('error-M4F-1017')).toBeVisible();
  await expect(page.getByLabel('Texto da chamada final', { exact: false })).toBeFocused();
  await expect(page.getByText('Quando preencher, use de 2 a 32 caracteres, sem emojis.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salve para ver depois', exact: true }).click();
  await page.getByTestId('setup-complete').click();
  await expect(page.getByTestId('draft-review')).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => (window as any).__m4f.plan.output)).toMatchObject({ width: 1080, height: 1080 });
});
