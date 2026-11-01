import { expect, test } from '@playwright/test';
import { pickVideos } from './ui';

test('platform and custom composition guides are UI-only and persist', async ({ page }) => {
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  const canvas = page.getByTestId('player-canvas');
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => (window as any).__m4f?.plan.captions.length > 0 && document.fonts.status === 'loaded');
  await page.waitForTimeout(250);
  const before = await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await page.getByTestId('guide-options').click();
  await page.getByLabel('Guia de composição').selectOption('shorts');
  await page.getByRole('checkbox', { name: 'Mostrar guia', exact: true }).check();
  await expect(page.getByTestId('guide-overlay')).toContainText('Shorts');
  const after = await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  expect(after).toBe(before);
  await page.getByLabel('Guia de composição').selectOption('custom');
  await page.getByLabel('Margem superior (%)').fill('18');
  expect(await page.getByTestId('guide-overlay').evaluate(element => (element as HTMLElement).style.top)).toBe('18%');
  await page.reload();
  await expect(page.getByTestId('guide-overlay')).toBeVisible({ timeout: 30_000 });
  expect(await page.getByTestId('guide-overlay').evaluate(element => (element as HTMLElement).style.top)).toBe('18%');
});
