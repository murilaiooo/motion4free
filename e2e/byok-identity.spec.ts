import { expect, test } from '@playwright/test';
import { closeSettings, settings } from './ui';

const ACCOUNT_A = 'sk-or-test-account-a-NOT-REAL';
const ACCOUNT_B = 'sk-or-test-account-b-NOT-REAL';

/** Todas as chamadas são interceptadas. Não usar nenhuma chave ou serviço real no teste. */
test('troca de chave descarta catálogo e modelo da conta antiga; HTTP 200 vazio não prova inferência', async ({ page }) => {
  const sent: string[] = [];
  let bAvailable = true;
  await page.route('https://openrouter.ai/api/v1/**', async (route) => {
    const req = route.request();
    const account = req.headers().authorization === `Bearer ${ACCOUNT_A}` ? 'a'
      : req.headers().authorization === `Bearer ${ACCOUNT_B}` ? 'b' : 'unknown';
    if (account === 'unknown') throw new Error('Não havia uma chave sintética conhecida');
    sent.push(`${req.method()}:${account}`);
    if (req.method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ choices: [{ message: { content: '' } }] }) });
      return;
    }
    const id = account === 'a' ? 'account-a:free' : 'account-b';
    const pricing = account === 'a' ? { prompt: '0', completion: '0' } : { prompt: '0.000002', completion: '0.000005' };
    await route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ data: account === 'b' && !bAvailable ? [] : [{ id, name: `Conta ${account.toUpperCase()}`, context_length: 65536,
        pricing, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] }),
    });
  });

  await page.goto('/');
  await page.getByTestId('open-settings').click();
  await settings(page, 'ia');
  await page.getByTestId('ai-key').check();
  await page.getByTestId('provider-openrouter').click();
  await page.getByTestId('key-input').fill(ACCOUNT_A);
  await page.getByTestId('key-connect').click();
  await expect(page.getByTestId('model-list')).toContainText('Conta A');
  await page.getByTestId('use-model-account-a:free').click();
  await page.getByTestId('consent-check').check();
  await expect(page.getByTestId('ai-ready')).toContainText('ainda não testado');

  await page.getByTestId('key-input').fill(ACCOUNT_B);
  await page.getByTestId('key-connect').click();
  await page.getByRole('button', { name: /Todos \(/ }).click();
  await expect(page.getByTestId('model-list')).toContainText('Conta B');
  await expect(page.getByTestId('model-list')).not.toContainText('Conta A');
  await expect(page.getByTestId('consent-box')).toHaveCount(0); // antigo modelo não vale para a chave nova
  await page.getByTestId('use-model-account-b').click();
  await expect(page.getByText('Este modelo pode gerar cobrança')).toBeVisible();
  await page.getByRole('button', { name: 'Usar mesmo assim' }).click();
  await expect(page.getByTestId('ai-ready')).toContainText('ainda não testado');

  await page.getByTestId('model-test').click();
  // Consentimento persistido não autoriza uma chamada individual automaticamente.
  const outbound = page.locator('dialog.set-outbound');
  await expect(outbound).toBeVisible();
  expect(sent).toEqual(['GET:a', 'GET:b']);
  await outbound.getByRole('button', { name: 'Autorizar este envio' }).click();
  // HTTP 200 sem texto nunca equivale a modelo funcionando.
  await expect(page.getByTestId('consent-box')).toContainText('M4F-1217');
  await expect(page.getByTestId('consent-box')).not.toContainText('Funcionou:');
  expect(sent).toEqual(['GET:a', 'GET:b', 'POST:b']);

  await closeSettings(page);
  await page.getByTestId('open-settings').click();
  await settings(page, 'ia');
  await expect(page.getByTestId('model-list')).toContainText('Conta B');
  expect(sent).toEqual(['GET:a', 'GET:b', 'POST:b']); // catálogo recente reutilizado apenas na mesma chave
  const persisted = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(persisted).not.toContain(ACCOUNT_A);
  expect(persisted).not.toContain(ACCOUNT_B);

  // Se o catálogo deixar de oferecer o modelo, a seleção antiga não pode continuar ativa.
  bAvailable = false;
  await page.getByRole('button', { name: 'Buscar modelos de novo' }).click();
  await expect(page.getByTestId('consent-box')).toHaveCount(0);
  await expect(page.getByTestId('provider-panel-openrouter')).toContainText('M4F-1209');
  expect(sent).toEqual(['GET:a', 'GET:b', 'POST:b', 'GET:b']);

  await page.getByTestId('key-forget').click();
  await expect(page.getByTestId('model-list')).toHaveCount(0);
  await expect(page.getByTestId('consent-box')).toHaveCount(0);
  expect(sent).toEqual(['GET:a', 'GET:b', 'POST:b', 'GET:b']);
});
