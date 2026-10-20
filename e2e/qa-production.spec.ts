import { expect, test } from '@playwright/test';

test('QA de produção: domínio público carrega a versão publicada e a interface real', async ({ page }) => {
  test.skip(process.env.PRODUCTION_SMOKE !== '1', 'Somente o job de smoke da produção acessa o site público');
  test.setTimeout(120_000);
  const url = 'https://motion4free.murdokmurilo1.workers.dev/';
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('sem enviar seu vídeo', { timeout: 60_000 });
  await expect(page.getByTestId('file-input')).toBeAttached();
  await expect(page.getByTestId('version')).toContainText('Motion4Free v0.15.0', { timeout: 60_000 });
  await expect(page.getByTestId('version')).toContainText('752bbe4', { timeout: 60_000 });
  await expect(page.locator('.showcase canvas').first()).toHaveAttribute('data-ready', '1', { timeout: 60_000 });
  await expect(page.getByText('Seu vídeo nunca sai deste aparelho')).toBeVisible();
  // Acesso a galeria sem backend / login. Não envia arquivos reais para nenhum serviço.
  await page.getByRole('link', { name: 'Modelos' }).click();
  await expect(page.getByRole('heading', { name: 'Modelos, cena por cena' })).toBeVisible({ timeout: 30_000 });
});
