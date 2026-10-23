import { expect, test } from '@playwright/test';

test('issue 73: no provider send before exact-body approval; revoke key cleanly in Brave', async ({ page }) => {
  let sends = 0;
  let sentBody = '';
  await page.route('https://api.groq.com/openai/v1/**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        data: [{ id: 'llama-3.3-70b-versatile', context_window: 131072, active: true }],
      }) });
      return;
    }
    sends++;
    sentBody = route.request().postData() ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }) });
  });
  await page.goto('/');
  await page.getByTestId('open-settings').first().click();
  await page.getByTestId('ai-key').check();
  await page.getByTestId('provider-groq').click();
  await page.getByTestId('key-input').fill('gsk_synthetic-qa-only');
  await page.getByTestId('key-connect').click();
  await expect(page.getByTestId('model-list')).toBeVisible();
  await page.getByTestId('use-model-llama-3.3-70b-versatile').click();
  await page.getByRole('button', { name: 'Usar mesmo assim' }).click();
  await page.getByTestId('consent-check').check();
  await page.getByTestId('model-test').click();
  const dialog = page.locator('dialog.set-outbound');
  await expect(dialog).toBeVisible();
  const preview = await dialog.locator('pre').textContent();
  expect(preview).toContain('Teste de conexão do Motion4Free.');
  expect(preview).not.toContain('gsk_synthetic-qa-only');
  expect(sends).toBe(0);
  await dialog.getByRole('button', { name: 'Cancelar envio' }).click();
  await expect(dialog).toHaveCount(0);
  expect(sends).toBe(0);

  await page.getByTestId('model-test').click();
  await expect(dialog).toBeVisible();
  const secondPreview = await dialog.locator('pre').textContent();
  await dialog.getByRole('button', { name: 'Autorizar este envio' }).click();
  await expect(page.getByText('Resposta confirmada.')).toBeVisible();
  expect(sends).toBe(1);
  expect(sentBody).toBe(secondPreview);

  await page.getByTestId('key-forget').click();
  await expect(page.getByTestId('key-open')).toHaveCount(0);
  const stored = await page.evaluate(() => Object.values(localStorage).join(' '));
  expect(stored).not.toContain('gsk_synthetic-qa-only');
});
