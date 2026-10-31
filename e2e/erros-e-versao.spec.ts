import { expect, test } from '@playwright/test';
import { pickVideos } from './ui';

test('mostra a versão do app no rodapé', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('version')).toHaveText(/^Motion4Free v\d+\.\d+\.\d+ · \w+$/);
});

test('falha ao baixar o modelo mostra código M4F-301 e ainda edita o vídeo', async ({ page }) => {
  await page.goto('/?asr=falha');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  const warning = page.getByTestId('warning-M4F-301');
  await expect(warning).toBeVisible({ timeout: 60_000 });
  await expect(warning).toContainText('huggingface.co');
  await expect(page.getByTestId('summary')).toContainText('0 legendas');
  await expect(page.getByTestId('export')).toBeEnabled();
});

test('arquivo que não é vídeo mostra código M4F-101', async ({ page }) => {
  await page.goto('/');
  await pickVideos(page, { name: 'nota.mp4', mimeType: 'video/mp4', buffer: Buffer.from('isto não é um vídeo') });
  await expect(page.getByTestId('error-M4F-101')).toBeVisible({ timeout: 30_000 });
});
