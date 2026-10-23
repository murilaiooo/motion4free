import { expect, test } from '@playwright/test';
import { tab } from './ui';

test('asset filtering and sorting leave the actual edit order untouched', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(['e2e/fixtures/fala-com-pausas.webm', 'e2e/fixtures/fala-com-pausas.webm']);
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('draft-customize').click();
  await tab(page, 'Mídia');
  const order = await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.segments));
  await expect(page.getByTestId('asset-card')).toHaveCount(2);
  await page.getByLabel('Ordenar arquivos').selectOption('name');
  await page.getByLabel('Buscar arquivos').fill('inexistente');
  await expect(page.getByText('Nenhum arquivo com esse nome.')).toBeVisible();
  await page.getByLabel('Buscar arquivos').fill('fala');
  await expect(page.getByTestId('asset-card')).toHaveCount(2);
  await expect(page.getByTestId('asset-card').first().locator('img')).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.segments))).toBe(order);
});
