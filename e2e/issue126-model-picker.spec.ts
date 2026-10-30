import { expect, test } from '@playwright/test';
import { settings } from './ui';

const KEY = 'sk-or-synthetic-126-not-a-real-credential';
const FIRST = 'qa/model-free:free';
const SECOND = 'qa/model-paid';

test('issue #126: escolher finalidade, testar modelo gratuito, excluir transcrição, sem pedido implícito', async ({ page }) => {
  let posts = 0;
  let content = '';
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    const req = route.request();
    if (req.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: [
          { id: FIRST, name: 'Teste gratuito', pricing: { prompt: '0', completion: '0' }, context_length: 20000, architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
          { id: SECOND, name: 'Teste pago', pricing: { prompt: '0.000003', completion: '0.000009' }, context_length: 20000, architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
        ] }) });
      return;
    }
    posts++;
    content = req.postData() ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: '{"ritmo":"rapido"}' } }] }) });
  });
  await page.goto('/');
  await settings(page, 'ia');
  await page.getByTestId('ai-key').check();

  await page.getByTestId('ai-purpose-audio').check();
  await expect(page.getByTestId('audio-incompatible')).toBeVisible();
  await expect(page.getByTestId('provider-openrouter')).toHaveCount(0);
  expect(posts).toBe(0);
  await page.getByTestId('ai-purpose-creative-brief').check();
  await page.getByTestId('provider-openrouter').click();

  await page.getByTestId('key-input').fill(KEY);
  await page.getByTestId('key-connect').click();
  await expect(page.getByTestId('model-list')).toBeVisible();
  await expect(page.getByTestId('model-inline-test-' + FIRST)).toBeVisible();
  await expect(page.getByTestId('test-model-' + FIRST)).toBeDisabled();
  expect(posts).toBe(0);
  await page.getByTestId('consent-quick').check();
  await page.getByTestId('test-model-' + FIRST).click();
  const dialog = page.locator('dialog.set-outbound');
  await expect(dialog).toBeVisible();
  expect(posts).toBe(0);
  const preview = await dialog.locator('pre').textContent();
  expect(preview).toContain('fictício');
  expect(preview).not.toContain(KEY);
  await dialog.getByRole('button', { name: 'Cancelar envio' }).click();
  expect(posts).toBe(0);
  await page.getByTestId('test-model-' + FIRST).click();
  await dialog.getByRole('button', { name: 'Autorizar este envio' }).click();
  await expect(page.getByTestId('model-inline-test-' + FIRST)).toContainText('Microteste de texto concluído');
  await page.getByTestId('task-use-model-' + FIRST).click();
  await expect(page.getByTestId('task-active-' + FIRST)).toContainText('Entender meus pedidos');
  await expect(page.getByTestId('ai-purpose-status')).toContainText('Chave aberta e envio de texto autorizado');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('m4f-ia') || '{}'));
  expect(stored.taskRoutes['creative-brief'].remote.id).toBe(FIRST);
  expect(stored.taskRoutes['creative-brief'].provider).toBe('openrouter');
  expect(JSON.stringify(stored)).not.toContain(KEY);
  expect(posts).toBe(1);
  expect(content).not.toContain(KEY);

  await page.getByRole('button', { name: /Todos \(/ }).click();
  await page.getByTestId('test-model-' + SECOND).click();
  expect(posts).toBe(1);
  await expect(page.getByRole('button', { name: 'Confirmar teste' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).last().click();
  expect(posts).toBe(1);
  await page.getByTestId('ai-purpose-audio').check();
  await expect(page.getByTestId('model-list')).toHaveCount(0);
  expect(posts).toBe(1);
});

test('issue #126: finalidade de clipes usa microteste específico, sem indicar sucesso a partir de HTTP 200 inválido', async ({ page }) => {
  let posts = 0;
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: FIRST, name: 'Modelo temporário', pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] }) });
      return;
    }
    posts++;
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: '{"melhor":"A"}' } }] }) });
  });
  await page.goto('/');
  await settings(page, 'ia');
  await page.getByTestId('ai-key').check();
  await page.getByTestId('ai-purpose-moment-ranking').check();
  await page.getByTestId('provider-openrouter').click();
  await page.getByTestId('key-input').fill(KEY);
  await page.getByTestId('key-connect').click();
  await expect(page.getByTestId('model-list')).toBeVisible();
  await page.getByTestId('consent-quick').check();
  await page.getByTestId('test-model-' + FIRST).click();
  const dialog = page.locator('dialog.set-outbound');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('pre')).toContainText('Por que economizar?');
  await dialog.getByRole('button', { name: 'Autorizar este envio' }).click();
  await expect(page.getByTestId('model-inline-test-' + FIRST)).toContainText('M4F-1007');
  await expect(page.getByTestId('model-inline-test-' + FIRST)).not.toContainText('concluído');
  expect(posts).toBe(1);
});