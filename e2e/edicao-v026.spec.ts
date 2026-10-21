import { expect, test, type Page } from '@playwright/test';
import { tab } from './ui';

/** v0.26: escolher vários e apagar de uma vez, máscara do vídeo e animação por pontos. */
const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';

async function openVideo(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}
const segments = (page: Page) => page.locator('[data-testid^="tl-seg-"]:not([data-testid$="-start"]):not([data-testid$="-end"])');
const planOf = (page: Page) => page.evaluate(() => (window as unknown as { __m4f: { plan: any } }).__m4f.plan);

test('escolher vários pedaços (Ctrl + clique e botão Vários) e apagar de uma vez', async ({ page }) => {
  await openVideo(page);
  await page.getByTestId('tl-seg-0').click();
  await page.keyboard.press('s');
  await expect(segments(page)).toHaveCount(3);

  await page.getByTestId('tl-seg-0').click();
  await page.getByTestId('tl-seg-2').click({ modifiers: ['Control'] });
  await expect(page.getByTestId('tl-multi-count')).toHaveText('2 escolhidos');
  await page.keyboard.press('Delete');
  await expect(segments(page)).toHaveCount(1);
  await page.getByTestId('undo').click();
  await expect(segments(page)).toHaveCount(3);

  // botão Vários: clique simples põe e tira; todos escolhidos não apaga (M4F-525)
  await page.getByTestId('tl-multi').click();
  for (const i of [0, 1, 2]) await page.getByTestId(`tl-seg-${i}`).click();
  await expect(page.getByTestId('tl-multi-count')).toHaveText('3 escolhidos');
  await page.getByTestId('tl-delete').click();
  await expect(page.getByTestId('error-M4F-525')).toBeVisible();
  await expect(segments(page)).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tl-multi-count')).toHaveCount(0);
});

test('máscara do vídeo: escolher forma, ajustar e tirar', async ({ page }) => {
  await openVideo(page);
  await tab(page, 'Mídia');
  await page.getByTestId('mask-shape-heart').click();
  await expect.poll(async () => (await planOf(page)).edits.mask?.shape).toBe('heart');
  await page.getByTestId('mask-shape-rect').click();
  await expect(page.getByTestId('mask-radius')).toBeVisible();
  await page.getByTestId('mask-size').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await planOf(page)).edits.mask?.size).toBeLessThan(0.8);
  await page.getByTestId('mask-shape-none').click();
  await expect.poll(async () => (await planOf(page)).edits.mask ?? null).toBeNull();
});

test('animação por pontos: marcar dois pontos e apagar a animação', async ({ page }) => {
  await openVideo(page);
  await tab(page, 'Texto');
  await page.getByTestId('add-text-texto').click();
  await expect(page.getByTestId('keyframes')).toBeVisible();
  await page.getByTestId('key-add').click();
  await expect(page.getByTestId('key-0')).toBeVisible();
  // 1 s depois, outro ponto
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Shift+ArrowRight');
  await page.getByTestId('key-add').click();
  await expect(page.getByTestId('key-1')).toBeVisible();
  await expect.poll(async () => (await planOf(page)).edits.added[0].keys?.length).toBe(2);
  await page.getByTestId('key-1-ease').selectOption('linear');
  await expect.poll(async () => (await planOf(page)).edits.added[0].keys?.[1]?.ease).toBe('linear');
  await expect(page.locator('[data-testid^="tl-key-"]')).toHaveCount(2);
  await page.getByTestId('key-clear').click();
  await expect.poll(async () => (await planOf(page)).edits.added[0].keys ?? null).toBeNull();
});
