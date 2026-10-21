import { expect, type Page } from '@playwright/test';

/**
 * Abre uma aba do painel de ferramentas (trilho à esquerda no computador, barra de baixo no celular).
 * v0.19: Pedido, Gancho e Trechos ficam juntos na aba IA; os dois últimos dentro de uma seção recolhível.
 */
export async function tab(page: Page, name: 'Modelos' | 'Texto' | 'Elementos' | 'Legendas' | 'Mídia' | 'Áudio' | 'IA' | 'Pedido' | 'Gancho' | 'Trechos' | 'Versões' | 'Cores') {
  const real = name === 'Pedido' || name === 'Gancho' || name === 'Trechos' ? 'IA' : name;
  const t = page.getByRole('tab', { name: real, exact: true });
  await t.click();
  await expect(t).toHaveAttribute('aria-selected', 'true');
  if (name === 'Gancho' || name === 'Trechos') {
    const fold = page.getByTestId(name === 'Gancho' ? 'fold-gancho' : 'fold-trechos');
    if ((await fold.getAttribute('open')) === null) await fold.locator('summary').click();
  }
}

/** Corrige uma legenda na transcrição: clica na legenda, troca o texto e confirma com Enter. */
export async function editCaption(page: Page, id: string, text: string) {
  await tab(page, 'Legendas');
  await page.getByTestId(`caption-${id}`).click();
  const input = page.getByTestId(`caption-input-${id}`);
  await expect(input).toBeFocused();
  await input.fill(text);
  await input.press('Enter');
}

/** Linha do tempo na vista Original (v0.17: a vista padrão é Edição, no tempo do vídeo final). */
export async function originalView(page: Page) {
  await page.getByTestId('tl-view-original').click();
  await expect(page.getByTestId('timeline')).toHaveAttribute('data-view', 'original');
}

/** Abre Configurações (v0.27) numa seção. O botão fica no topo de todas as telas. */
export async function settings(page: Page, section: 'ia' | 'transcricao' | 'armazenamento' | 'editor' | 'privacidade' | 'sobre') {
  if ((await page.getByTestId('settings-screen').count()) === 0) await page.getByTestId('open-settings').first().click();
  await page.getByTestId(`settings-nav-${section}`).click();
  await expect(page.getByTestId(`settings-section-${section}`)).toBeVisible();
}

export async function closeSettings(page: Page) {
  await page.getByTestId('settings-screen').getByRole('button', { name: 'Fechar' }).first().click();
  await expect(page.getByTestId('settings-screen')).toHaveCount(0);
}

/** Tema saiu da barra do topo na v0.27: fica em Configurações › Editor e aparência. */
export async function pickTheme(page: Page, theme: 'light' | 'dark') {
  await settings(page, 'editor');
  await page.getByTestId(`theme-${theme}`).click();
  await closeSettings(page);
}
