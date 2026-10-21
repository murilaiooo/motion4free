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
  page.on('console', (message) => {
    if (message.text().includes('QA_PROJECT_')) console.log('QA_BROWSER_TRACE', message.text());
  });
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
  // Espere a transação do projeto terminar: a falha da cópia do vídeo é independente
  // do save de project.json. Reload instantâneo durante autosave não é teste de recuperação.
  await page.waitForFunction(async () => {
    try {
      const root = await navigator.storage.getDirectory();
      const app = await root.getDirectoryHandle('motion4free');
      const state = await (await app.getFileHandle('state.json')).getFile();
      const id: unknown = JSON.parse(await state.text()).current;
      if (typeof id !== 'string') return false;
      const projects = await app.getDirectoryHandle('projects');
      const folder = await projects.getDirectoryHandle(id);
      const file = await (await folder.getFileHandle('project.json')).getFile();
      const meta = await (await folder.getFileHandle('meta.json')).getFile();
      return file.size > 100 && meta.size > 100;
    } catch { return false; }
  }, null, { timeout: 45_000 });
  await page.reload();
  const recoverySnapshot = await page.evaluate(async () => {
    try {
      const root = await navigator.storage.getDirectory();
      const app = await root.getDirectoryHandle('motion4free');
      const state = JSON.parse(await (await (await app.getFileHandle('state.json')).getFile()).text()) as { current?: string };
      const projects = await app.getDirectoryHandle('projects');
      let fallback: string | null = null;
      for await (const [name] of (projects as any).entries()) { fallback = name; break; }
      const dir = await projects.getDirectoryHandle(state.current ?? fallback!);
      const metaText = await (await (await dir.getFileHandle('meta.json')).getFile()).text();
      const dataText = await (await (await dir.getFileHandle('project.json')).getFile()).text();
      const meta = JSON.parse(metaText) as Record<string, unknown>;
      const data = JSON.parse(dataText) as Record<string, any>;
      return { current: state.current, fallback, meta, projectKeys: Object.keys(data), projectFormat: data.format,
        historyKeys: Object.keys(data.history ?? {}), clips: data.history?.present?.clips,
        video: data.video, versions: data.versions?.length, bytes: { meta: metaText.length, project: dataText.length } };
    } catch (e) { return { diagnosticError: String(e) }; }
  });
  console.log('QA_DISK_RECOVERY_SNAPSHOT', JSON.stringify(recoverySnapshot));
  // Não confundir ausência da cópia do vídeo com corrupção do plano.
  await expect(page.getByText('Projeto que não abre')).toHaveCount(0, { timeout: 45_000 });
  // A retomada automática pode ser desativada se o navegador descartar a preferência "atual".
  if (await page.getByRole('button', { name: 'Abrir', exact: true }).count()) {
    await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  }
  await expect(page.locator('body')).toContainText(/Selecione novamente o vídeo original|Para continuar o projeto salvo.*vídeo original/i, { timeout: 90_000 });
});


test('concorrência: trava nova importação durante análise de clipes e libera ao terminar', async ({ page }) => {
  test.setTimeout(180_000);
  // Torna observável o estado ocupado da importação; não depende da velocidade do CI.
  await page.addInitScript(() => {
    if (!navigator.storage?.estimate) return;
    const original = navigator.storage.estimate.bind(navigator.storage);
    Object.defineProperty(navigator.storage, 'estimate', {
      configurable: true,
      value: async () => {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return original();
      },
    });
  });
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(MEDIA);
  await expect(page.getByTestId('clip-c1')).toBeVisible({ timeout: 90_000 });
  const chooser = page.locator('[data-testid="clip-list"] input[type=file]');
  await chooser.setInputFiles('e2e/fixtures/clip-blue.webm');
  await expect(chooser).toBeDisabled({ timeout: 10_000 });
  await expect(page.getByTestId('clip-c2')).toBeVisible({ timeout: 90_000 });
  await expect(chooser).toBeEnabled({ timeout: 90_000 });
  await expect(page.getByTestId('clip-c3')).toHaveCount(0);
});


test('segurança: nome de vídeo com HTML malicioso permanece texto, sem execução de script no editor', async ({ page }) => {
  test.setTimeout(150_000);
  const suspicious = '<img src=x onerror=window.__m4fInjected=1>.webm';
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles({
    name: suspicious, mimeType: 'video/webm', buffer: readFileSync(MEDIA),
  });
  await expect(page.getByTestId('project-menu')).toContainText(suspicious.slice(0, -5), { timeout: 90_000 });
  await expect(page.locator('img[onerror]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__m4fInjected)).toBeUndefined();
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 45_000 });
  await page.reload();
  await expect(page.getByTestId('project-menu')).toContainText(suspicious.slice(0, -5), { timeout: 90_000 });
  expect(await page.evaluate(() => (window as any).__m4fInjected)).toBeUndefined();
});
