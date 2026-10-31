import { expect, test } from '@playwright/test';
import { closeSettings, settings, pickVideos } from './ui';

/** Precisão da legenda (v0.8): opção Rápida/Precisa, aviso de modelo reserva e página ?avaliar. */

test('opção "Precisão da legenda" aparece com o tamanho do download e fica lembrada', async ({ page }) => {
  await page.goto('/');
  // v0.27: a área de envio mostra o resumo; as opções ficam em Configurações › Transcrição
  await expect(page.getByTestId('asr-summary')).toContainText('Precisa');
  await page.getByTestId('asr-change').click();
  const box = page.getByTestId('asr-precision');
  await expect(box).toBeVisible();
  await expect(box).toContainText('Precisa');
  await expect(box).toContainText('Rápida');
  await expect(box).toContainText(/baixa cerca de \d/);
  await expect(page.getByTestId('asr-precisa')).toBeChecked();
  await page.getByTestId('asr-rapida').check();
  await closeSettings(page);
  await expect(page.getByTestId('asr-summary')).toContainText('Rápida');
  await page.reload();
  await settings(page, 'transcricao');
  await expect(page.getByTestId('asr-rapida')).toBeChecked();
});

test('modelo preciso falha: legenda sai com o modelo leve e aviso M4F-307 diz qual foi usado', async ({ page }) => {
  await page.goto('/?asr=reserva');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  const warning = page.getByTestId('warning-M4F-307');
  await expect(warning).toBeVisible({ timeout: 60_000 });
  await expect(warning).toContainText('Whisper small');
  await expect(page.getByTestId('summary')).not.toContainText('0 legendas');
  await expect(page.getByTestId('asr-model')).toContainText('Whisper small');
});

test('transcrição normal mostra o modelo que fez a legenda', async ({ page }) => {
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('asr-model')).toContainText('Whisper large-v3-turbo', { timeout: 60_000 });
  await expect(page.getByTestId('warning-M4F-307')).toHaveCount(0);
});

test('página ?avaliar abre com vídeo, texto de referência e escolha do modelo', async ({ page }) => {
  await page.goto('/?avaliar');
  await expect(page.getByRole('heading', { name: /avaliar a legenda/ })).toBeVisible();
  await expect(page.getByTestId('eval-run')).toBeDisabled();
  await page.getByTestId('eval-file').setInputFiles('e2e/fixtures/fala-com-pausas.webm');
  await page.getByTestId('eval-reference').fill('três dicas rápidas primeira dica');
  await expect(page.getByTestId('eval-run')).toBeEnabled();
  await expect(page.getByTestId('eval-model').locator('option')).toHaveCount(6);
});
