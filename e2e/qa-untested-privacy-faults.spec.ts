import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const MEDIA = 'e2e/fixtures/clip-red.webm';

test('privacidade: nome privado do vídeo não aparece em URLs nem em corpos de requisições de rede', async ({ page }) => {
  test.setTimeout(120_000);
  const secret = 'M4F_PRIVATE_FILENAME_NEVER_EXFILTRATE_7e9c';
  const requests: { method: string; url: string; body: string }[] = [];
  page.on('request', req => requests.push({
    method: req.method(), url: req.url(), body: req.postData() ?? '',
  }));
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles({
    name: `${secret}.webm`, mimeType: 'video/webm', buffer: readFileSync(MEDIA),
  });
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('format-select').selectOption('quadrado');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 40_000 });
  // Somente requisições GET/HEAD para o site e fontes. Nenhum conteúdo privado sai pelo navegador.
  const unsafe = requests.filter(req => req.url.includes(secret) ||
    req.body.includes(secret) || !['GET','HEAD'].includes(req.method) ||
    !new URL(req.url).hostname.match(/^(localhost|127\.0\.0\.1)$/));
  expect(unsafe).toEqual([]);
});

test('armazenamento OPFS indisponível: o editor funciona e avisa que o projeto não será salvo', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    if (navigator.storage) Object.defineProperty(navigator.storage, 'getDirectory', {
      configurable: true, value: undefined,
    });
  });
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(MEDIA);
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('warning-M4F-601')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('saved')).toHaveCount(0);
  await page.getByTestId('export').click();
  await expect(page.getByTestId('download')).toBeVisible({ timeout: 150_000 });
});

test('falha real no write de video.bin: não mostra falso Salvo e solicita original após reinício', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    const proto = (window as any).FileSystemFileHandle?.prototype;
    if (!proto?.createWritable) return;
    const original = proto.createWritable;
    proto.createWritable = function (...args: unknown[]) {
      if (this.name === 'video.bin') return Promise.reject(new DOMException('disco cheio', 'QuotaExceededError'));
      return original.apply(this, args);
    };
  });
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(MEDIA);
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('warning-M4F-601')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId('saved')).toHaveCount(0);
  await page.reload();
  // Dados do projeto permanecem, mas o arquivo original não foi persistido.
  await expect(page.getByText('Escolha de novo o vídeo original', { exact: false })).toBeVisible({ timeout: 90_000 });
});
