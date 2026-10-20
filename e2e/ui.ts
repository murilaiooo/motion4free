import { expect, type Page } from '@playwright/test';

/** Abre uma aba do painel de ferramentas (trilho à esquerda no computador, barra de baixo no celular). */
export async function tab(page: Page, name: 'Modelos' | 'Pedido' | 'Legendas' | 'Gancho' | 'Trechos' | 'Versões' | 'Cores') {
  const t = page.getByRole('tab', { name, exact: true });
  await t.click();
  await expect(t).toHaveAttribute('aria-selected', 'true');
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
