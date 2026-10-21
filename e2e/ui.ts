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
