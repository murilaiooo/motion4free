import { expect, test } from '@playwright/test';

test('QA de produção: domínio público carrega a versão publicada e a interface real', async ({ page }) => {
  test.skip(process.env.PRODUCTION_SMOKE !== '1', 'Somente o job de smoke da produção acessa o site público');
  test.setTimeout(300_000);
  const url = 'https://motion4free.murdokmurilo1.workers.dev/';
  const expectedCommit = process.env.EXPECTED_PUBLIC_COMMIT?.slice(0, 7);
  expect(expectedCommit).toMatch(/^[0-9a-f]{7}$/);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('sem enviar seu vídeo', { timeout: 60_000 });
  await expect(page.getByTestId('file-input')).toBeAttached();
  await expect(page.getByTestId('version')).toHaveText(/^Motion4Free v\d+\.\d+\.\d+ · [a-f0-9]{7}$/, { timeout: 60_000 });
  // No push da main a Cloudflare pode terminar depois do Actions. Verifique com retry, nunca aceite versão antiga.
  await expect(async () => {
    await page.goto(`${url}?qa=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await expect(page.getByTestId('version')).toContainText(expectedCommit!, { timeout: 10_000 });
  }).toPass({ timeout: 240_000, intervals: [5_000, 10_000, 15_000] });
  await expect(page.locator('.lp-reel canvas').first()).toHaveAttribute('data-ready', '1', { timeout: 60_000 });
  await expect(page.getByText('Seu vídeo nunca sai deste aparelho')).toBeVisible();
  // Acesso a galeria sem backend / login. Não envia arquivos reais para nenhum serviço.
  await page.getByRole('link', { name: 'Modelos' }).click();
  await expect(page.getByRole('heading', { name: 'Modelos, cena por cena' })).toBeVisible({ timeout: 30_000 });
});
