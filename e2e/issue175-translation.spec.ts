import { expect, test } from '@playwright/test';
import { editCaption, pickVideos, tab } from './ui';

/**
 * #175: a tradução local nunca troca a legenda original quando o tradutor falha.
 * O download do modelo é bloqueado de propósito: o caminho de sucesso exige o modelo real
 * (ver docs/development/ISSUE_RESOLUTION_PROGRESS.md) e não é simulado aqui.
 */
test('translation failure keeps the original captions and shows a coded error (#175)', async ({ page }) => {
  await page.route(/huggingface\.co|\/hf\/Xenova\//, (route) => route.abort('blockedbyclient'));
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  // a fala do arquivo de teste é em português; as legendas viram inglês para chegar ao tradutor
  const ids = await page.evaluate(() => (window as any).__m4f.plan.captions.map((c: { id: string }) => c.id) as string[]);
  const english = ['Hello, how are you doing today?', 'This is the first tip and it is simple.', 'You do not need anything else.'];
  for (const [i, id] of ids.entries()) await editCaption(page, id, english[i % english.length]!);
  const before = await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.captions));
  const historyBefore = await page.evaluate(() => (window as any).__m4f.history.past.length);
  await tab(page, 'Legendas');
  // inglês reconhecido sozinho; o destino padrão é português
  await expect(page.getByTestId('translation-source')).toHaveValue('en');
  await expect(page.getByTestId('translation-target')).toHaveValue('pt');
  await page.getByTestId('translate-subtitles').click();
  const error = page.getByTestId('translation-error');
  await expect(error).toContainText('M4F-319', { timeout: 60_000 });
  await expect(page.getByTestId('translation-progress')).toHaveCount(0);
  // nada foi trocado: mesmas legendas, sem faixa traduzida, sem passo novo no histórico
  expect(await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.captions))).toBe(before);
  expect(await page.evaluate(() => (window as any).__m4f.plan.subtitleTranslation ?? null)).toBeNull();
  expect(await page.evaluate(() => (window as any).__m4f.history.past.length)).toBe(historyBefore);
  await expect(page.getByTestId('subtitle-track-translated')).toHaveCount(0);
  // o botão volta a ficar disponível para tentar de novo
  await expect(page.getByTestId('translate-subtitles')).toBeEnabled();
});

test('a chosen language that does not match the captions is refused before any download (M4F-320)', async ({ page }) => {
  let modelRequests = 0;
  await page.route(/huggingface\.co|\/hf\/Xenova\//, (route) => { modelRequests++; return route.abort('blockedbyclient'); });
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  const before = await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.captions));
  await tab(page, 'Legendas');
  // a legenda do arquivo de teste é português (letras latinas); dizer que é russo não pode seguir
  await page.getByTestId('translation-source').selectOption('ru');
  await page.getByTestId('translate-subtitles').click();
  await expect(page.getByTestId('translation-error')).toContainText('M4F-320');
  expect(await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.captions))).toBe(before);
  expect(modelRequests).toBe(0);
});

test('Portuguese captions can be translated to any of the 10 languages through the 100-language model (v0.45.0)', async ({ page }) => {
  const requested: string[] = [];
  await page.route(/huggingface\.co|\/hf\/Xenova\//, (route) => { requested.push(route.request().url()); return route.abort('blockedbyclient'); });
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  const before = await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.captions));
  await tab(page, 'Legendas');
  await expect(page.getByTestId('translation-source')).toHaveValue('pt');
  await expect(page.getByTestId('translation-target')).toHaveValue('en');
  // as 10 línguas, menos a da legenda
  const targets = await page.getByTestId('translation-target').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(targets.sort()).toEqual(['ar', 'bn', 'en', 'es', 'fr', 'hi', 'ru', 'ur', 'zh']);
  await page.getByTestId('translation-target').selectOption('zh');
  await page.getByTestId('translate-subtitles').click();
  await expect(page.getByTestId('translation-error')).toContainText('M4F-319', { timeout: 60_000 });
  expect(requested.some((u) => u.includes('Xenova/m2m100_418M'))).toBe(true);
  expect(requested.some((u) => u.includes('opus-mt'))).toBe(false);
  expect(await page.evaluate(() => JSON.stringify((window as any).__m4f.plan.captions))).toBe(before);
});
