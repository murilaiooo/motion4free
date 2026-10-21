import { expect, test, type Page } from '@playwright/test';

async function assertControlNames(page: Page, context: string) {
  const buttons = page.locator('button:visible:not([aria-hidden="true"])');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(2);
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    await expect(button, `${context}: botão visível sem nome acessível (posição ${i})`)
      .toHaveAccessibleName(/\S/);
  }
}

test('acessibilidade antes não coberta: botões da tela inicial e do editor têm nomes acessíveis', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?asr=vazio');
  await assertControlNames(page, 'inicial');
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/clip-red.webm');
  await expect(page.getByTestId('clip-c1')).toBeVisible({ timeout: 90_000 });
  await assertControlNames(page, 'editor');
  await expect(page.getByTestId('format-select')).toHaveAccessibleName(/Formato de saída/i);
});
