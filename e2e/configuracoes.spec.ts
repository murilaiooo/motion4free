import { expect, test } from '@playwright/test';
import { closeSettings, settings, tab } from './ui';

/** Configurações (v0.27, issue #73): abre de qualquer tela, tem as 6 seções e não mexe no projeto aberto. */

test('Configurações abre no início com as seis seções explicadas', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings-screen')).toBeVisible();
  for (const id of ['ia', 'transcricao', 'armazenamento', 'editor', 'privacidade', 'sobre'] as const) {
    await settings(page, id);
    await expect(page.getByTestId(`settings-section-${id}`).locator('.hint').first()).toBeVisible();
  }
  await settings(page, 'privacidade');
  await expect(page.getByTestId('settings-section-privacidade')).toContainText('Nenhum serviço');
  await settings(page, 'sobre');
  await expect(page.getByTestId('settings-version')).toContainText(/^v\d+\.\d+\.\d+$/);
  await closeSettings(page);
});

test('a mesa fica só com edição e Configurações não perde o projeto aberto', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles('e2e/fixtures/fala-com-pausas.webm');
  const duration = page.getByTestId('out-duration');
  await expect(duration).toBeVisible({ timeout: 60_000 });
  const before = await duration.textContent();
  // tema e armazenamento saíram da barra do topo
  await expect(page.getByRole('button', { name: 'Usar tema claro' })).toHaveCount(0);
  await expect(page.getByTestId('menu-storage')).toHaveCount(0);
  // a aba IA mostra só a IA em uso e o atalho para mudar
  await tab(page, 'IA');
  await expect(page.getByTestId('ai-status')).toContainText('só regras');
  await expect(page.getByTestId('key-input')).toHaveCount(0);

  await page.getByTestId('ai-change').click();
  await expect(page.getByTestId('settings-section-ia')).toBeVisible();
  await settings(page, 'armazenamento');
  await expect(page.getByTestId('storage-total')).toBeVisible({ timeout: 30_000 });
  await closeSettings(page);
  await expect(duration).toHaveText(before!);
});
