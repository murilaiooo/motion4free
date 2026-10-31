import { expect, test } from '@playwright/test';
import { statSync } from 'node:fs';
import { pickVideos } from './ui';

test('issue #4: baixa backup completo e restaura sem substituir o projeto', async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  await page.goto('/?asr=vazio');
  await expect(page.getByTestId('project-restore-input')).toHaveCount(1);
  await pickVideos(page, 'e2e/fixtures/clip-red.webm');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('menu-close').click();

  const original = page.locator('[data-testid^="project-p-"]');
  await expect(original).toHaveCount(1);
  await expect(page.getByTestId('project-backup')).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByTestId('project-backup').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^motion4free-p-[a-z0-9-]+\.m4f$/);
  const file = info.outputPath('backup-completo.m4f');
  await download.saveAs(file);
  expect(statSync(file).size).toBeGreaterThan(10_000);

  await page.getByTestId('project-restore-input').setInputFiles(file);
  await expect(page.locator('[data-testid^="project-p-"]')).toHaveCount(2, { timeout: 60_000 });
  const ids = await page.locator('[data-testid^="project-p-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')));
  expect(new Set(ids).size).toBe(2);
  await page.locator('[data-testid^="project-p-"]').first().getByTestId('project-open-btn').click();
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('warning-M4F-604')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('menu-close').click();
  await expect(page.locator('[data-testid^="project-p-"]')).toHaveCount(2);

  // Reimportar em um perfil limpo prova que a mídia veio do arquivo, não do OPFS anterior.
  const other = await browser.newContext({ acceptDownloads: true, baseURL: 'http://localhost:4173' });
  try {
    const fresh = await other.newPage();
    await fresh.goto('/?asr=vazio');
    await fresh.getByTestId('project-restore-input').setInputFiles(file);
    await expect(fresh.locator('[data-testid^="project-p-"]')).toHaveCount(1, { timeout: 60_000 });
    await fresh.getByTestId('project-open-btn').click();
    await expect(fresh.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });
    await expect(fresh.getByTestId('warning-M4F-604')).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test('issue #4: arquivo falso não cria projeto e restauração fica disponível com biblioteca vazia', async ({ page }) => {
  await page.goto('/?asr=vazio');
  const restore = page.getByTestId('project-restore-input');
  await expect(restore).toHaveCount(1);
  await restore.setInputFiles({ name: 'falso.m4f', mimeType: 'application/octet-stream', buffer: Buffer.from('não é um projeto') });
  await expect(page.locator('[data-testid^="project-p-"]')).toHaveCount(0);
  await expect(page.getByTestId('flash')).toHaveCount(0);
});
