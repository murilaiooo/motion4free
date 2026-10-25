import { expect, test } from '@playwright/test';
import { settings } from './ui';

test('configuração avançada é simples, opcional e mantém escolhas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  await settings(page, 'ia');

  const advanced = page.getByTestId('ai-advanced-settings');
  await expect(advanced.locator('summary').first()).toHaveText('Personalizar o uso da IA (opcional)');
  await expect(advanced).not.toHaveAttribute('open', '');
  await advanced.locator('summary').first().click();

  const tasks = page.getByTestId('ai-task-settings');
  await expect(tasks).not.toHaveAttribute('open', '');
  await tasks.locator('summary').first().click();

  const creative = page.getByRole('combobox', { name: 'Ideias e instruções de edição' });
  await expect(creative).toHaveValue('default');
  await creative.selectOption('rules');
  await expect(creative).toHaveValue('rules');

  const limits = page.getByTestId('ai-usage-settings');
  await expect(limits).not.toHaveAttribute('open', '');
  await limits.locator('summary').first().click();
  await expect(page.getByText('Pedidos por projeto')).toBeVisible();
  await expect(page.getByText('Mais limites')).toBeVisible();

  await page.reload();
  await page.getByTestId('open-settings').click();
  await settings(page, 'ia');
  await page.getByTestId('ai-advanced-settings').locator('summary').first().click();
  await page.getByTestId('ai-task-settings').locator('summary').first().click();
  await expect(page.getByRole('combobox', { name: 'Ideias e instruções de edição' })).toHaveValue('rules');
  expect(errors).toEqual([]);
});
