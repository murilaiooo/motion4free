import { expect, test, type Page } from '@playwright/test';
import { tab } from './ui';

/** Novo visual (v0.10): primeira tela, abas, transcrição, galeria de modelos, exportar, atalhos e telas pequenas. */

const FIXTURE = 'e2e/fixtures/fala-com-pausas.webm';

async function openVideo(page: Page, query = '') {
  await page.goto(`/${query}`);
  await page.getByTestId('file-input').setInputFiles(FIXTURE);
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
}

const seconds = async (page: Page) => Number((await page.getByTestId('player-time').textContent())!.split(' s')[0]!.replace(',', '.'));

test('primeira tela: promessa, área para soltar o vídeo, privacidade e exemplos de modelos desenhados', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('sem enviar seu vídeo');
  await expect(page.getByText('Escolher vídeos').first()).toBeVisible();
  await expect(page.getByText('Seu vídeo nunca sai deste aparelho')).toBeVisible();
  const thumbs = page.locator('.lp-reel canvas');
  await expect(thumbs.first()).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
  // o quadro de exemplo não é vazio (drawFrame desenhou)
  const lit = await thumbs.first().evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 64) if (d[i]! + d[i + 1]! + d[i + 2]! > 30) n++;
    return n;
  });
  expect(lit).toBeGreaterThan(100);
});

test('todas as ferramentas ficam a um clique (e pelas setas do teclado)', async ({ page }) => {
  await openVideo(page);
  const tabs = ['Modelos', 'Texto', 'Elementos', 'Legendas', 'Mídia', 'IA', 'Gancho', 'Trechos', 'Versões', 'Cores'] as const;
  const marks: Record<(typeof tabs)[number], string> = {
    Modelos: 'style-pop',
    Texto: 'add-text-título',
    Elementos: 'add-shape-arrow',
    Legendas: 'transcript',
    Mídia: 'clip-and-format',
    IA: 'brief-input',
    Gancho: 'hooks',
    Trechos: 'range-new',
    Versões: 'version-name',
    Cores: 'reference',
  };
  for (const t of tabs) {
    await tab(page, t);
    await expect(page.getByTestId(marks[t])).toBeVisible();
  }
  // setas trocam de aba
  await page.getByRole('tab', { name: 'Cores', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: 'Modelos', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Modelos', exact: true })).toBeFocused();
  // prévia, detalhes, linha do tempo e "O que mudou" ficam visíveis ao mesmo tempo no computador
  await expect(page.getByTestId('player-canvas')).toBeVisible();
  await expect(page.getByTestId('timeline')).toBeVisible();
  await expect(page.getByTestId('changes')).toBeVisible();
  await expect(page.getByTestId('version')).toHaveText(/^Motion4Free v\d+\.\d+\.\d+ · \w+$/);
});

test('transcrição: clicar numa palavra leva a prévia até ela; a palavra falada fica em destaque', async ({ page }) => {
  await openVideo(page, '?asr=demo');
  await tab(page, 'Legendas');
  const transcript = page.getByTestId('transcript');
  await expect(transcript).toContainText('Primeira dica: luz');
  // clicar em "Primeira" (segunda frase) leva o player para depois de 1 s
  await transcript.getByText('Primeira', { exact: true }).click();
  await expect.poll(() => seconds(page)).toBeGreaterThan(1);
  // a legenda abriu para corrigir; Esc fecha sem mudar
  await page.keyboard.press('Escape');
  await expect(transcript.locator('[data-active="word"]')).toHaveCount(1);
  await expect(transcript.locator('[data-active="word"]')).toHaveText(/Primeira/);
});

test('galeria de modelos: filtro por etiqueta, cartão escolhido marcado e desfazer', async ({ page }) => {
  await openVideo(page);
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tpl-card.selected .tpl-check')).toHaveCount(1);
  await page.getByRole('button', { name: 'Elegante', exact: true }).click();
  await expect(page.getByTestId('style-editorial')).toBeVisible();
  await expect(page.getByTestId('style-pop')).toHaveCount(0);
  await page.getByTestId('style-editorial').click();
  await expect(page.getByTestId('style-editorial')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'false');
  // a miniatura é um quadro de verdade
  await expect(page.getByTestId('style-neon').locator('canvas')).toHaveAttribute('data-ready', '1');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('style-pop')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByTestId('style-editorial')).toHaveAttribute('aria-pressed', 'true');
});

test('atalhos e prévia: espaço toca e pausa, área segura do Reels liga e desliga', async ({ page }) => {
  await openVideo(page);
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.getByTestId('preview-overlay').click({ position: { x: 5, y: 5 } }); // clicar na prévia também toca
  await expect(page.getByTestId('play')).toHaveText('Pausar');
  await page.locator('.stage-head').click();
  await page.keyboard.press(' ');
  await expect(page.getByTestId('play')).toHaveText('Assistir');
  await page.keyboard.press('l');
  await expect.poll(() => seconds(page)).toBeGreaterThan(0.9);
  await page.keyboard.press('j');
  await expect.poll(() => seconds(page)).toBeLessThan(1);
  await page.getByRole('button', { name: 'Mostrar área segura do Reels' }).click();
  await expect(page.locator('.safe-zone')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar área segura do Reels' }).click();
  await expect(page.locator('.safe-zone')).toHaveCount(0);
});

test('exportar pela barra do topo mostra progresso, o vídeo e o botão de baixar; dá para fechar', async ({ page }) => {
  await openVideo(page);
  await page.getByRole('button', { name: 'Exportar' }).click();
  const panel = page.getByTestId('export-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('download')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('result-video')).toBeVisible();
  await panel.getByRole('button', { name: 'Fechar' }).click();
  await expect(panel).toHaveCount(0);
});

test('tema claro fica lembrado depois de recarregar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar tema claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Usar tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const [w, h] of [
  [390, 844],
  [768, 1024],
  [1280, 800],
] as const) {
  test(`tela ${w}×${h}: sem rolagem para o lado e ferramentas alcançáveis`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByTestId('file-input').setInputFiles(FIXTURE);
    await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByTestId('player-canvas')).toBeVisible();
    await expect(page.getByTestId('export')).toBeVisible();
    // a barra das ferramentas aparece inteira na tela
    const rail = await page.getByRole('tablist', { name: 'Ferramentas' }).boundingBox();
    expect(rail!.x).toBeGreaterThanOrEqual(0);
    expect(rail!.y + rail!.height).toBeLessThanOrEqual(h + 1);
    await tab(page, 'Legendas');
    await expect(page.getByTestId('caption-c2')).toBeVisible();
    await page.getByTestId('caption-c2').click();
    await expect(page.getByTestId('caption-input-c2')).toBeFocused();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
