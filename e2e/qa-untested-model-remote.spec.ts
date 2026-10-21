import { expect, test } from '@playwright/test';

const SITE = 'https://motion4free.murdokmurilo1.workers.dev';
const MODELS = [
  'onnx-community/whisper-base_timestamped',
  'onnx-community/whisper-small_timestamped',
];

for (const model of MODELS) {
  test(`modelo Whisper real: espelho remoto serve config válido de ${model}`, async ({ request }) => {
    test.skip(process.env.QA_REMOTE_MODELS !== '1', 'Apenas a bateria externa verifica a rede real.');
    test.setTimeout(75_000);
    const url = `${SITE}/hf/${model}/resolve/main/config.json`;
    const result = await request.get(url, { timeout: 50_000, failOnStatusCode: false });
    expect(result.status(), `falha do modelo remoto ${model}`).toBe(200);
    expect(result.headers()['x-m4f-mirror']).toBe('huggingface.co');
    const json = await result.json();
    expect(typeof json.model_type).toBe('string');
    expect(json.model_type.length).toBeGreaterThan(1);
    expect(JSON.stringify(json).length).toBeGreaterThan(100);
  });
}

test('espelho remoto impede escrita POST em arquivos dos modelos', async ({ request }) => {
  test.skip(process.env.QA_REMOTE_MODELS !== '1', 'Apenas a bateria externa verifica o contrato HTTP.');
  const url = `${SITE}/hf/onnx-community/whisper-base_timestamped/resolve/main/config.json`;
  const res = await request.post(url, { data: 'M4F_FORBIDDEN_UPLOAD', failOnStatusCode: false });
  expect(res.status()).toBe(405);
});
