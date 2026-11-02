import { expect, test } from '@playwright/test';
import { pickVideos, tab } from './ui';

/**
 * #175: a tradução local nunca troca a legenda original quando o tradutor falha.
 * O download do modelo é bloqueado de propósito: o caminho de sucesso exige o modelo real
 * (ver docs/development/ISSUE_RESOLUTION_PROGRESS.md) e não é simulado aqui.
 */
test('translation failure keeps the original captions and shows a coded error (#175)', async ({ page }) => {
  await page.route(/huggingface\.co|\/hf\/Xenova\/opus-mt/, (route) => route.abort('blockedbyclient'));
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  const before = await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.captions));
  const historyBefore = await page.evaluate(() => (window as any).__m4f.history.past.length);
  await tab(page, 'Legendas');
  await page.getByTestId('translate-subtitles').click();
  const error = page.getByTestId('translation-error');
  await expect(error).toContainText('M4F-319', { timeout: 60_000 });
  await expect(page.getByTestId('translation-progress')).toHaveCount(0);
  // nada foi trocado: mesmas legendas, sem faixa traduzida, sem passo novo no histórico
  expect(await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.captions))).toBe(before);
  expect(await page.evaluate(() => (window as any).__m4f.plan.subtitleTranslation ?? null)).toBeNull();
  expect(await page.evaluate(() => (window as any).__m4f.history.past.length)).toBe(historyBefore);
  await expect(page.getByTestId('subtitle-track-pt')).toHaveCount(0);
  // o botão volta a ficar disponível para tentar de novo
  await expect(page.getByTestId('translate-subtitles')).toBeEnabled();
});
