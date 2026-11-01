import { expect, test } from '@playwright/test';
import { closeSettings, pickTheme, settings, pickVideos } from './ui';

test('resizing persists, keyboard works, cancel restores and playback canvas stays mounted', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  const splitter = page.getByRole('separator', { name: 'Largura da biblioteca' });
  await expect(splitter).toBeVisible();
  const canvas = page.getByTestId('player-canvas');
  await canvas.evaluate(element => element.setAttribute('data-mount-proof', 'same-canvas'));
  const start = await splitter.getAttribute('aria-valuenow');
  await splitter.focus();
  await splitter.press('ArrowRight');
  expect(Number(await splitter.getAttribute('aria-valuenow'))).toBeGreaterThan(Number(start));
  const saved = await splitter.getAttribute('aria-valuenow');
  await page.reload();
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 30_000 });
  await expect(splitter).toHaveAttribute('aria-valuenow', saved!);
  await canvas.evaluate(element => element.setAttribute('data-mount-proof', 'same-canvas'));
  const box = (await splitter.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 50);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(splitter).toHaveAttribute('aria-valuenow', saved!);
  await expect(canvas).toHaveAttribute('data-mount-proof', 'same-canvas');
  // v0.27: "Restaurar tamanhos dos painéis" mudou para Configurações › Editor e aparência
  await settings(page, 'editor');
  await page.getByTestId('layout-reset').click();
  await closeSettings(page);
  await expect(splitter).toHaveAttribute('aria-valuenow', '320');
  await page.screenshot({ path: test.info().outputPath('workbench-1366.png') });
});

test('workspace remains bounded at compact widths and survives corrupt preferences', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('m4f.workbench-layout.v1', '{corrupt'));
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  for (const width of [1920, 1024, 768]) {
    await page.setViewportSize({ width, height: 768 });
    await expect(page.getByTestId('player-canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`workbench-${width}.png`) });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await pickTheme(page, 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: test.info().outputPath('workbench-light.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Recolher painel de ferramentas' }).click();
  await expect(page.getByRole('separator', { name: 'Largura da biblioteca' })).toBeHidden();
  await page.getByRole('tab', { name: 'Mídia', exact: true }).click();
  await expect(page.getByRole('separator', { name: 'Largura da biblioteca' })).toBeVisible();
});
