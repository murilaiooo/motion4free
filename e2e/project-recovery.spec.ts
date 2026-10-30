import { expect, test, type Page } from '@playwright/test';

/**
 * Recuperação de projetos (v0.16). Vem do QA do PR #55: quando a cópia do vídeo (video.bin) não era
 * gravada, ao reabrir aparecia "Projeto que não abre". A causa: a cópia do vídeo era gravada antes das
 * edições, e a espera do teste antigo (`waitForFunction` com função async) passava na hora, sem esperar.
 */
const MEDIA = 'e2e/fixtures/clip-red.webm';

/** Lê no OPFS da página quais arquivos o projeto atual tem e de que tamanho. */
async function savedFiles(page: Page): Promise<Record<string, number> | null> {
  return page.evaluate(async () => {
    try {
      const root = await navigator.storage.getDirectory();
      const app = await root.getDirectoryHandle('motion4free');
      const state = JSON.parse(await (await (await app.getFileHandle('state.json')).getFile()).text()) as { current?: unknown };
      if (typeof state.current !== 'string') return null;
      const dir = await (await app.getDirectoryHandle('projects')).getDirectoryHandle(state.current);
      const out: Record<string, number> = {};
      for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
        if (h.kind === 'file') out[name] = (await (h as FileSystemFileHandle).getFile()).size;
      }
      return out;
    } catch {
      return null;
    }
  });
}

test('video.bin não cabe (QuotaExceeded): sem falso "Salvo" e, ao reabrir, pede o vídeo original', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    const proto = (window as unknown as { FileSystemFileHandle?: { prototype: { createWritable?: (...a: unknown[]) => Promise<unknown> } } }).FileSystemFileHandle?.prototype;
    if (!proto?.createWritable) return;
    const original = proto.createWritable;
    proto.createWritable = function (this: { name: string }, ...args: unknown[]) {
      if (this.name === 'video.bin') return Promise.reject(new DOMException('disco cheio', 'QuotaExceededError'));
      return original.apply(this, args);
    };
  });
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(MEDIA);
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 90_000 });
  // Avisos do editor ficam recolhidos na prévia até a pessoa abrir o painel.
  await expect(page.getByTestId('stage-warning-toggle')).toBeVisible({ timeout: 40_000 });
  await page.getByTestId('stage-warning-toggle').click();
  await expect(page.getByTestId('warning-M4F-601')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('saved')).toHaveCount(0);
  // expect.poll espera de verdade (a função async do waitForFunction devolvia uma Promise, que já conta como "pronto")
  await expect.poll(async () => {
    const files = await savedFiles(page);
    return !!files && (files['project.json'] ?? 0) > 100 && (files['meta.json'] ?? 0) > 100;
  }, { timeout: 45_000 }).toBe(true);
  // a gravação que falhou não deixa um video.bin vazio fingindo ser cópia
  expect((await savedFiles(page))?.['video.bin']).toBeUndefined();
  await page.reload();
  await expect(page.getByTestId('warning-M4F-604')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Projeto que não abre')).toHaveCount(0);
  await expect(page.getByTestId('project-damaged')).toHaveCount(0);
  // escolher o mesmo vídeo continua a edição
  await page.getByTestId('file-input').setInputFiles(MEDIA);
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 90_000 });
});

test('aba fechada durante a cópia do vídeo: as edições já estavam salvas e o projeto reabre', async ({ page }) => {
  test.setTimeout(150_000);
  // a cópia do vídeo "nunca termina" (vídeo grande num disco lento), como se a pessoa fechasse a aba no meio
  await page.addInitScript(() => {
    const proto = (window as unknown as { FileSystemFileHandle?: { prototype: { createWritable?: (...a: unknown[]) => Promise<unknown> } } }).FileSystemFileHandle?.prototype;
    if (!proto?.createWritable) return;
    const original = proto.createWritable;
    proto.createWritable = function (this: { name: string }, ...args: unknown[]) {
      if (this.name === 'video.bin') return new Promise(() => undefined);
      return original.apply(this, args);
    };
  });
  await page.goto('/?asr=vazio');
  await page.getByTestId('file-input').setInputFiles(MEDIA);
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 90_000 });
  await expect.poll(async () => ((await savedFiles(page))?.['project.json'] ?? 0) > 100, { timeout: 45_000 }).toBe(true);
  await page.reload();
  await expect(page.getByTestId('warning-M4F-604')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Projeto que não abre')).toHaveCount(0);
  await expect(page.getByTestId('project-interrupted')).toHaveCount(0);
});

test('pasta sem edições (importação interrompida): cartão próprio, aviso M4F-617 e apagar funciona', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?asr=vazio');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const app = await root.getDirectoryHandle('motion4free', { create: true });
    const dir = await (await app.getDirectoryHandle('projects', { create: true })).getDirectoryHandle('p-interrompido1', { create: true });
    const w = await (await dir.getFileHandle('video.bin', { create: true })).createWritable();
    await w.write(new Uint8Array(2048));
    await w.close();
    const s = await (await app.getFileHandle('state.json', { create: true })).createWritable();
    await s.write(JSON.stringify({ current: 'p-interrompido1' }));
    await s.close();
  });
  await page.reload();
  await expect(page.getByTestId('warning-M4F-617')).toBeVisible({ timeout: 30_000 });
  const card = page.getByTestId('project-p-interrompido1');
  await expect(card).toContainText('Importação interrompida');
  await expect(card.getByTestId('project-interrupted')).toBeVisible();
  await expect(page.getByText('Projeto que não abre')).toHaveCount(0);
  await card.getByTestId('project-delete').click();
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId('project-p-interrompido1')).toHaveCount(0, { timeout: 15_000 });
});
