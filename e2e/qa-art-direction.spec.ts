import { expect, test } from '@playwright/test';

/**
 * Prova automatizada de diferenciação visual, não uma nota estética.
 * O mesmo arquivo deve gerar quadros diferentes, não só mudar o nome do preset no DOM.
 */
test('QA criativo técnico: a mesma fala produz quadros visualmente diferentes com três estilos', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?asr=demo');
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 90_000 });
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('l');
  const canvas = page.getByTestId('player-canvas');
  const signature = () => canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const d = ctx.getImageData(0, 0, el.width, el.height).data;
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < d.length; i += 124) {
      hash = Math.imul(hash ^ d[i]!, 16777619) >>> 0;
      hash = Math.imul(hash ^ d[i + 1]!, 16777619) >>> 0;
    }
    return hash;
  });
  const signatures: Record<string, number> = {};
  for (const id of ['pop', 'podcast', 'cinema']) {
    await page.getByTestId(`style-${id}`).click();
    await expect(page.getByTestId(`style-${id}`)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(signature, { timeout: 30_000 }).not.toBe(0);
    if (Object.values(signatures).length) {
      await expect.poll(async () => {
        const next = await signature();
        return Object.values(signatures).includes(next) ? 'igual' : 'diferente';
      }, { timeout: 30_000 }).toBe('diferente');
    }
    signatures[id] = await signature();
  }
  expect(new Set(Object.values(signatures)).size).toBe(3);
});
