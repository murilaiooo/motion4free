import { expect, test } from '@playwright/test';
test('avisos recolhíveis preservam o espaço da prévia e detalhes (#82)', async ({ page }) => {
  await page.goto('/?asr=reserva');
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('stage-warning-toggle')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('stage-warning-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('warning-M4F-307')).toHaveCount(0);
  const height = await page.getByTestId('stage-notices').evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(90);
  await page.getByTestId('stage-warning-toggle').click();
  await expect(page.getByTestId('warning-M4F-307')).toBeVisible();
  await expect(page.getByTestId('stage-warning-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.getByTestId('stage-warning-toggle').click();
  await expect(page.getByTestId('warning-M4F-307')).toHaveCount(0);
  await expect(page.getByTestId('player-canvas')).toBeVisible();
});
