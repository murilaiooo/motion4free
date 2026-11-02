import { expect, test } from '@playwright/test';
import { settings } from './ui';

const model = 'nvidia/nemotron-synthetic:free';

for (const outcome of ['success', 'exhausted', 'cancel', 'mandatory'] as const) {
  test(`issue 163: raciocínio OpenRouter, recuperação ${outcome} com consentimento exato`, async ({ page }) => {
    const sent: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://openrouter.ai/api/v1/**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { data: [{ id: model, name: 'Nemotron sintético', pricing: { prompt: '0', completion: '0' }, context_length: 32768 }] } });
        return;
      }
      sent.push(route.request().postData()!);
      if (outcome === 'mandatory') {
        await route.fulfill({ status: 400, json: { error: { message: 'Reasoning is mandatory for this synthetic model.' } } });
        return;
      }
      await route.fulfill({ json: sent.length === 1 || outcome === 'exhausted'
        ? { choices: [{ finish_reason: 'length', message: { content: '', reasoning: 'The user wants me to answer the synthetic test.' } }] }
        : { choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] } });
    });
    await page.goto('/');
    await settings(page, 'ia');
    await page.getByTestId('ai-key').check();
    await page.getByTestId('provider-openrouter').click();
    await page.getByTestId('key-input').fill('sk-or-synthetic-not-a-real-key');
    await page.getByTestId('key-connect').click();
    await page.getByTestId(`use-model-${model}`).click();
    await page.getByTestId('consent-check').check();
    await page.getByTestId('model-test').click();
    const dialog = page.locator('dialog.set-outbound');
    await expect(dialog).toBeVisible();
    const first = await dialog.locator('pre').innerText();
    expect(JSON.parse(first).reasoning).toEqual({ effort: 'none' });
    expect(first).not.toContain('sk-or-synthetic');
    expect(sent).toHaveLength(0);
    await dialog.getByRole('button', { name: 'Autorizar este envio', exact: true }).click();
    await expect(dialog.locator('pre')).not.toHaveText(first);
    const second = await dialog.locator('pre').innerText();
    expect(JSON.parse(second).reasoning).toEqual({ max_tokens: 2048 });
    expect(sent).toEqual([first]);
    await dialog.getByRole('button', { name: outcome === 'cancel' ? 'Cancelar envio' : 'Autorizar este envio', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    if (outcome === 'success') await expect(page.getByText('Resposta confirmada.', { exact: true })).toBeVisible();
    else await expect(page.getByTestId('consent-box')).toContainText(outcome === 'cancel' ? 'M4F-1218' : 'M4F-1018');
    expect(sent).toEqual(outcome === 'cancel' ? [first] : [first, second]);
    expect(errors).toEqual([]);
  });
}
