import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';
type Plan = { edits: { added: { id: string; text: string }[] } };

async function planOf(page: Page): Promise<Plan> {
  return page.evaluate(() => (window as unknown as { __m4f: { plan: Plan } }).__m4f.plan);
}

test('versão restaura composição completa, desfazer/refazer e reabertura no Brave', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });

  await page.getByRole('tab', { name: 'Versões', exact: true }).click();
  const original = await planOf(page);
  await page.getByTestId('version-name').fill('Antes do título novo');
  await page.getByTestId('version-save').click();
  await expect(page.getByTestId('version-v1')).toBeVisible();

  await page.getByRole('tab', { name: 'Texto', exact: true }).click();
  await page.getByTestId('add-text-título').click();
  await expect(page.getByTestId('tl-el-e1')).toBeVisible();
  expect((await planOf(page)).edits.added).toHaveLength(original.edits.added.length + 1);

  await page.getByRole('tab', { name: 'Versões', exact: true }).click();
  await page.keyboard.press('Escape'); // solta o título para exibir o painel O que mudou
  await expect(page.getByTestId('changes-list')).toContainText('título', { timeout: 5_000 });
  await page.getByTestId('version-compare-v1').click();
  await page.getByTestId('version-compare-v1').click();
  await page.getByTestId('version-restore-v1').click();
  await expect(page.getByTestId('tl-el-e1')).toHaveCount(0);
  expect(await planOf(page)).toEqual(original);

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('tl-el-e1')).toBeVisible();
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('tl-el-e1')).toHaveCount(0);

  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('tab', { name: 'Versões', exact: true }).click();
  await expect(page.getByTestId('version-v1')).toBeVisible();
  await expect(page.getByTestId('tl-el-e1')).toHaveCount(0);
  expect(await planOf(page)).toEqual(original);
});
