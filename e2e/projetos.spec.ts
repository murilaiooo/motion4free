import { expect, test, type Page } from '@playwright/test';
import { editCaption, tab } from './ui';

/** v0.11: Meus projetos, menu do projeto (fechar/apagar) e tela Armazenamento. */

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';

async function newVideo(page: Page) {
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
}

async function closeProject(page: Page) {
  await page.getByTestId('project-menu').click();
  await page.getByTestId('menu-close').click();
  await expect(page.getByTestId('projects')).toBeVisible({ timeout: 30_000 });
}

const cards = (page: Page) => page.locator('[data-testid^="project-p-"]');
const totalBytes = async (page: Page) => Number(await page.getByTestId('storage-total').getAttribute('data-bytes'));

async function openStorage(page: Page) {
  await page.getByTestId('open-storage').click();
  await expect(page.getByTestId('storage-screen')).toBeVisible();
  await expect(page.getByTestId('storage-total')).toBeVisible({ timeout: 30_000 });
}

async function closeStorage(page: Page) {
  await page.getByTestId('storage-screen').getByRole('button', { name: 'Fechar' }).first().click();
  await expect(page.getByTestId('storage-screen')).toHaveCount(0);
}

test('dois projetos: lista, renomeia, apaga um, armazenamento muda, apaga modelo e "Apagar tudo"', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('projects')).toHaveCount(0);

  // primeiro projeto, fechado pelo menu: continua salvo e aparece na lista
  await newVideo(page);
  await editCaption(page, 'c1', 'Projeto um.');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await closeProject(page);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().locator('img.proj-thumb')).toBeVisible();

  // segundo vídeo cria outro projeto (não substitui o primeiro)
  await newVideo(page);
  await closeProject(page);
  await expect(cards(page)).toHaveCount(2);
  await expect(page.getByTestId('projects')).toContainText('2 projetos');

  // renomear
  const first = cards(page).first();
  await first.getByTestId('project-rename').click();
  await first.getByTestId('project-rename-input').fill('Dicas de casa');
  await first.getByTestId('project-rename-input').press('Enter');
  await expect(page.locator('[data-project-name="Dicas de casa"]')).toHaveCount(1);

  // armazenamento: dois projetos medidos
  await openStorage(page);
  const screen = page.getByTestId('storage-screen');
  await expect(screen.locator('[data-testid^="storage-item-project-"]')).toHaveCount(2);
  await expect(screen).toContainText('Tudo fica só neste computador');
  await expect(page.getByTestId('storage-quota')).toBeVisible();
  const before = await totalBytes(page);
  expect(before).toBeGreaterThan(0);
  await closeStorage(page);

  // apagar um projeto: diálogo diz o que sai, quanto libera e que o original fica
  const target = page.locator('[data-project-name="Dicas de casa"]');
  await target.getByTestId('project-delete').click();
  const dialog = page.getByTestId('delete-dialog');
  await expect(dialog).toContainText('Não dá para desfazer');
  await expect(dialog).toContainText('fala-com-pausas.webm');
  await expect(dialog).toContainText('nunca apaga nem altera');
  await expect(page.getByTestId('delete-dialog-size')).toHaveText(/\d+(,\d)? (KB|MB)/);
  await page.getByTestId('delete-confirm').click();
  await expect(dialog).toHaveCount(0);
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByTestId('flash')).toContainText('Liberou');

  // o total mostrado diminui
  await openStorage(page);
  await expect(screen.locator('[data-testid^="storage-item-project-"]')).toHaveCount(1);
  await expect.poll(async () => {
    await closeStorage(page);
    await openStorage(page);
    return totalBytes(page);
  }, { timeout: 20_000 }).toBeLessThan(before);
  await closeStorage(page);

  // modelo de legenda em cache (entrada de mentira, ~3 MB, no mesmo lugar onde o Transformers.js guarda)
  await page.evaluate(async () => {
    const cache = await caches.open('transformers-cache');
    await cache.put(`${location.origin}/hf/onnx-community/whisper-base_timestamped/resolve/main/onnx/encoder_model_quantized.onnx`, new Response(new Uint8Array(3 * 1024 * 1024)));
  });
  await openStorage(page);
  const model = page.getByTestId('storage-item-asr-onnx-community-whisper-base-timestamped');
  await expect(model).toContainText('Whisper base');
  await expect(model.getByTestId('storage-item-size')).toHaveText('3 MB');
  await model.getByTestId('storage-delete').click();
  await model.getByTestId('storage-confirm-delete').click();
  await expect(page.getByTestId('storage-notice')).toContainText('baixado de novo');
  await expect(model).toHaveCount(0);
  expect(await page.evaluate(() => caches.has('transformers-cache'))).toBe(false);

  // apagar tudo, com confirmação forte
  await page.getByTestId('delete-all').click();
  await expect(page.getByTestId('delete-all-confirm')).toBeDisabled();
  await page.getByTestId('delete-all-input').fill('apagar');
  await page.getByTestId('delete-all-confirm').click();
  await expect(page.getByTestId('storage-notice')).toContainText('Tudo do Motion4Free foi apagado');
  await expect(screen.locator('[data-testid^="storage-item-project-"]')).toHaveCount(0);
  await closeStorage(page);
  await expect(page.getByTestId('projects')).toHaveCount(0);
  const left = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const names: string[] = [];
    for await (const [name] of (root as unknown as { entries(): AsyncIterable<[string, unknown]> }).entries()) names.push(name);
    return { opfs: names, caches: await caches.keys() };
  });
  expect(left).toEqual({ opfs: [], caches: [] });
});

test('apagar o projeto aberto pelo menu do editor volta para a primeira tela', async ({ page }) => {
  await page.goto('/');
  await newVideo(page);
  await page.getByTestId('project-menu').click();
  await expect(page.getByTestId('project-menu-list')).toContainText('Trocar vídeo');
  await page.getByTestId('menu-delete').click();
  const dialog = page.getByTestId('delete-dialog');
  await expect(dialog).toContainText('Apagar o projeto "fala-com-pausas"?');
  await expect(page.getByTestId('delete-dialog-size')).toHaveText(/\d+(,\d)? (KB|MB)/);
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId('file-input')).toBeAttached();
  await expect(page.getByTestId('projects')).toHaveCount(0);
  // recarregar não traz o projeto de volta
  await page.reload();
  await expect(page.getByTestId('file-input')).toBeAttached();
  await expect(page.getByTestId('out-duration')).toHaveCount(0);
});

test('renomear pelo menu do editor e abrir pela lista', async ({ page }) => {
  await page.goto('/');
  await newVideo(page);
  await page.getByTestId('project-menu').click();
  await page.getByTestId('menu-rename').click();
  await page.getByTestId('project-name-input').fill('Meu Reels');
  await page.getByTestId('project-name-input').press('Enter');
  await expect(page.getByTestId('project-menu')).toContainText('Meu Reels');
  await closeProject(page);
  const card = page.locator('[data-project-name="Meu Reels"]');
  await expect(card).toHaveCount(1);
  await card.getByTestId('project-open-btn').click();
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('project-menu')).toContainText('Meu Reels');
});

test('projeto salvo pela v0.10 (um projeto só) entra em "Meus projetos" sem perder edições', async ({ page }) => {
  await page.goto('/');
  await newVideo(page);
  await editCaption(page, 'c2', 'Dica da versão antiga.');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  // volta o armazenamento para o formato da v0.10: motion4free-projeto/{project.json, video.bin}
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const projects = await (await root.getDirectoryHandle('motion4free')).getDirectoryHandle('projects');
    let src: FileSystemDirectoryHandle | null = null;
    for await (const [, h] of (projects as unknown as { entries(): AsyncIterable<[string, FileSystemDirectoryHandle]> }).entries()) src = h;
    const legacy = await root.getDirectoryHandle('motion4free-projeto', { create: true });
    for (const name of ['project.json', 'video.bin']) {
      const file = await (await src!.getFileHandle(name)).getFile();
      const w = await (await legacy.getFileHandle(name, { create: true })).createWritable();
      await w.write(file);
      await w.close();
    }
    await root.removeEntry('motion4free', { recursive: true });
  });
  await page.reload();
  // abre direto no projeto (era o projeto aberto) com a edição
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  await tab(page, 'Legendas');
  await expect(page.getByTestId('caption-c2')).toHaveText('Dica da versão antiga.');
  await closeProject(page);
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator('[data-project-name="fala-com-pausas"]')).toHaveCount(1);
  const legacyLeft = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle('motion4free-projeto').then(
      () => true,
      () => false,
    );
  });
  expect(legacyLeft).toBe(false);
});

test('pouco espaço: aviso M4F-606 antes de abrir o vídeo, com "Continuar mesmo assim"', async ({ page }) => {
  await page.addInitScript(() => {
    const storage = navigator.storage as StorageManager & { estimate: () => Promise<StorageEstimate> };
    storage.estimate = async () => ({ usage: 0, quota: 1000 });
  });
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  const warning = page.getByTestId('warning-M4F-606');
  await expect(warning).toBeVisible({ timeout: 30_000 });
  await expect(warning).toContainText('precisa de cerca de');
  await expect(page.getByTestId('out-duration')).toHaveCount(0);
  await page.getByTestId('space-storage').click();
  await expect(page.getByTestId('storage-screen')).toBeVisible();
  await closeStorage(page);
  await page.getByTestId('space-continue').click();
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
});
