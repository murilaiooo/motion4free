import { expect, test } from '@playwright/test';

/**
 * v0.38 (ADR-0039): o degrau Parakeet baixa os três arquivos pelo caminho do app, carrega o parakeet.js
 * no mesmo onnxruntime-web do Transformers.js e entrega os bytes ao ONNX. O Hugging Face e o jsdelivr não
 * são alcançáveis aqui: os arquivos do modelo são falsos (servidos pelo teste) e o runtime vem do
 * node_modules. O esperado é o ONNX recusar o arquivo falso (M4F-302), provando que tudo antes dele funciona.
 */
test('degrau Parakeet baixa os arquivos, carrega o parakeet.js no runtime compartilhado e chega ao ONNX', async ({ page, context }) => {
  const seen: string[] = [];
  await context.route(/huggingface\.co\/ysdede\/parakeet-tdt-0\.6b-v3-onnx\/resolve\/main\//, async (route) => {
    const url = route.request().url();
    seen.push(url.split('/').pop()!);
    if (url.endsWith('vocab.txt')) return route.fulfill({ status: 200, contentType: 'text/plain', body: '<unk> 0\n▁a 1\n<blk> 2\n' });
    return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(4096, 7) });
  });
  await context.route(/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@[^/]+\/dist\//, async (route) => {
    const name = route.request().url().split('/').pop()!;
    return route.fulfill({ path: `node_modules/onnxruntime-web/dist/${name}`, contentType: name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', headers: { 'access-control-allow-origin': '*' } });
  });
  const logs: string[] = [];
  page.on('console', (m) => logs.push(m.text()));

  await page.goto('/?avaliar');
  await page.getByTestId('eval-file').setInputFiles('e2e/fixtures/fala-com-pausas.webm');
  await page.getByTestId('eval-reference').fill('três dicas');
  await page.getByTestId('eval-model').selectOption('parakeet-wasm');
  await page.getByTestId('eval-run').click();
  await expect(page.locator('body')).toContainText('M4F-302', { timeout: 90_000 });
  await page.getByText('Detalhes técnicos').click();
  await expect(page.locator('body')).toContainText(/parakeet-wasm: .*protobuf parsing failed/);

  expect(seen.sort()).toEqual(['decoder_joint-model.int8.onnx', 'encoder-model.int8.onnx', 'vocab.txt']);
  // um runtime só: o parakeet.js recebeu o onnxruntime-web/webgpu do Transformers.js
  expect(logs.some((l) => l.includes('[Parakeet.js] ORT structure') && l.includes('hasWebgpu: true'))).toBe(true);
});
