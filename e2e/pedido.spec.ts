import { expect, test, type Page } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';
import { tab } from './ui';

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';

async function openVideo(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}

async function ask(page: Page, text: string) {
  await tab(page, 'Pedido');
  await page.getByTestId('brief-input').fill(text);
  await page.getByTestId('brief-apply').click();
}

test('pedido por texto muda estilo e cenas, mostra o que entendeu e entra no desfazer', async ({ page }) => {
  await openVideo(page);
  // O Creative Setup agora começa em Editorial. Este cenário precisa explicitamente do Pop,
  // com número grande, para testar que uma proibição remove essa cena e o undo a restaura.
  await page.getByTestId('style-pop').click();
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'true');
  // A quantidade de cenas depende da fala e da direção criativa; não exigir um número grande
  // que o conteúdo talvez não justifique. A proibição abaixo continua sendo testada.
  await expect(page.getByTestId('scene-summary')).toBeVisible();

  // contraditório: proibição vence
  await ask(page, 'bem animado mas sem efeitos, sem números');
  const summary = page.getByTestId('brief-summary');
  await expect(summary).toBeVisible();
  await expect(page.getByTestId('brief-forbidden')).toContainText('números grandes');
  await expect(page.getByTestId('brief-forbidden')).toContainText('efeitos');
  await expect(page.getByTestId('brief-conflicts')).toContainText('a proibição vale mais');
  await expect(page.getByTestId('scene-summary')).not.toContainText('número grande');
  await expect(page.getByTestId('scene-summary')).not.toContainText('zoom');
  await expect(page.getByTestId('scene-summary')).not.toContainText('transiç');

  // pedido de estilo
  // (v0.9: "minimalista" tem modelo próprio)
  await ask(page, 'minimalista e elegante');
  await expect(page.getByTestId('style-minimal')).toHaveAttribute('aria-pressed', 'true');
  await expect(summary).toContainText('Estilo Minimal');

  // desfazer volta ao pedido anterior (texto, estilo e resumo)
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('brief-input')).toHaveValue('bem animado mas sem efeitos, sem números');
  await expect(page.getByTestId('brief-forbidden')).toContainText('números grandes');

  // pedido que não diz nada conhecido: aviso, nada muda
  await ask(page, 'xyz abc');
  await expect(page.getByTestId('warning-M4F-1003')).toBeVisible();
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'true');

  // vazio: erro com código
  await ask(page, '   ');
  await expect(page.getByTestId('error-M4F-1001')).toBeVisible();
});

test('escolhe um gancho da própria fala e exporta um MP4 válido', async ({ page }, info) => {
  await openVideo(page);
  // a fala de teste tem duas frases: as duas viram candidatas
  await tab(page, 'Gancho');
  await expect(page.getByTestId('hook-0')).toBeVisible();
  await expect(page.getByTestId('hook-1')).toBeVisible();
  await expect(page.getByTestId('hook-2')).toHaveCount(0);
  await expect(page.getByTestId('hook-none')).toBeChecked();

  // "gancho forte" escolhe o melhor candidato
  await ask(page, 'gancho forte, estilo documental');
  await expect(page.getByTestId('style-documental')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('hook-0')).toBeChecked();
  await expect(page.getByTestId('opening-title')).toHaveText('Abre com: “Três dicas rápidas.”');

  // a pessoa troca o gancho; o texto é exatamente o falado
  await tab(page, 'Gancho');
  await expect(page.getByTestId('hook-1').locator('xpath=..')).toContainText('“Primeira dica.”');
  await page.getByTestId('hook-1').check();
  await expect(page.getByTestId('hook-1')).toBeChecked();
  await expect(page.getByTestId('opening-title')).toHaveText('Abre com: “Primeira dica.”');

  await page.getByTestId('undo').click();
  await expect(page.getByTestId('hook-0')).toBeChecked();
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('hook-1')).toBeChecked();

  await page.getByTestId('export').click();
  const download = page.getByTestId('download');
  await expect(download).toBeVisible({ timeout: 90_000 });
  await expect(download).toHaveAttribute('data-style', 'Documental');
  await expect(download).toHaveAttribute('data-export-where', 'worker');
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const path = info.outputPath('pedido.mp4');
  await file.saveAs(path);
  const input = new Input({ source: new FilePathSource(path), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  expect(video?.displayWidth).toBe(1080);
  expect(video?.displayHeight).toBe(1920);
  expect((await input.getPrimaryAudioTrack())?.codec).toBe('aac');
  expect(await input.computeDuration()).toBeGreaterThan(2.5);
});

test('pedido e gancho voltam depois de recarregar; a chave própria avisa que só vai texto', async ({ page }) => {
  await openVideo(page);
  await ask(page, 'calmo, sem zoom, gancho forte');
  await expect(page.getByTestId('brief-forbidden')).toContainText('zoom');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByTestId('brief-forbidden')).toContainText('zoom', { timeout: 60_000 });
  await expect(page.getByTestId('brief-input')).toHaveValue('calmo, sem zoom, gancho forte');
  await expect(page.getByTestId('hook-0')).toBeChecked();

  await tab(page, 'Pedido');
  // v0.27: serviço com chave própria fica em Configurações; sem chave, a mesa avisa e o pedido usa as regras
  await page.getByTestId('ai-change').click();
  await page.getByTestId('ai-key').check();
  await expect(page.getByTestId('provider-setup')).toContainText('o Motion4Free não tem servidor');
  await page.getByTestId('provider-gemini').click();
  await expect(page.getByTestId('provider-panel-gemini')).toContainText('Google AI Studio');
  await expect(page.getByTestId('key-input')).toHaveAttribute('type', 'password');
  await page.getByTestId('settings-screen').getByRole('button', { name: 'Fechar' }).first().click();
  await expect(page.getByTestId('ai-status')).toContainText('Falta escolher um modelo');
});
