import { expect, test, type Page } from '@playwright/test';
import { closeSettings, settings, tab, pickVideos } from './ui';

/** v0.31: variações A/B (#118), trocas parciais (#11), destaques automáticos (#117) e transcrição por API (#127). */

async function openVideo(page: Page) {
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}

test('variações: cria 3 versões para comparar, com explicação', async ({ page }) => {
  await openVideo(page);
  await tab(page, 'Versões');
  await page.getByTestId('variants-create').click();
  await expect(page.getByTestId('variants-notes').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('version-list').locator('li')).toHaveCount(3);
  await expect(page.getByTestId('version-list')).toContainText('Energética');
  await expect(page.getByTestId('version-list')).toContainText('Elegante');
  await expect(page.getByTestId('version-list')).toContainText('Direta');
  // comparar alterna sem erro
  const compare = page.locator('[data-testid^="version-compare-"]').first();
  await compare.click();
  await expect(compare).toHaveAttribute('aria-pressed', 'true');
});

test('pedido "outro estilo" troca só o estilo e o desfazer volta', async ({ page }) => {
  await openVideo(page);
  const before = await page.locator('[data-testid^="style-"][aria-pressed="true"]').first().getAttribute('data-testid');
  await tab(page, 'Pedido');
  await page.getByTestId('brief-input').fill('outro estilo');
  await page.getByTestId('brief-apply').click();
  await expect(page.getByTestId('brief-partial')).toContainText('Troquei só o estilo');
  await page.getByTestId('undo').click();
  if (before) await expect(page.getByTestId(before)).toHaveAttribute('aria-pressed', 'true');
});

test('destaques automáticos nas palavras', async ({ page }) => {
  await openVideo(page);
  await tab(page, 'Legendas');
  const suggest = page.getByTestId('semantic-suggest');
  if (await page.getByTestId('semantic-no-words').count()) test.skip(true, 'fixture sem palavras confirmadas');
  await suggest.click();
  await expect(page.getByTestId('semantic-suggest-result')).toBeVisible();
  if ((await page.getByTestId('semantic-suggest-result').textContent())?.includes('Adicionei')) await expect(page.getByTestId('semantic-cue-list')).toBeVisible();
});

test('transcrição por API: escolha clara, autorização de áudio separada e volta ao computador', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('asr-summary')).toContainText('o áudio não sai daqui');
  await settings(page, 'transcricao');
  await page.getByTestId('asr-kind-api').check();
  await expect(page.getByTestId('asr-api-box')).toBeVisible();
  await expect(page.getByTestId('asr-status')).toContainText('Groq');
  await expect(page.getByTestId('asr-status')).toContainText('chave');
  await page.getByTestId('asr-provider-openai').click();
  await expect(page.getByTestId('asr-status')).toContainText('OpenAI');
  await expect(page.getByTestId('asr-audio-consent')).not.toBeChecked();
  await page.getByTestId('asr-kind-local').check();
  await expect(page.getByTestId('asr-status')).toContainText('o áudio não sai daqui');
  await closeSettings(page);
});

test('sem chave, transcrição por API cai no computador com aviso M4F-308 e não envia nada', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (r) => { if (/api\.(groq|openai)\.com/.test(r.url())) sent.push(r.url()); });
  await page.goto('/');
  await settings(page, 'transcricao');
  await page.getByTestId('asr-kind-api').check();
  await closeSettings(page);
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('stage-warning-toggle').click();
  await expect(page.getByTestId('warning-M4F-308')).toBeVisible();
  expect(sent).toEqual([]);
});
