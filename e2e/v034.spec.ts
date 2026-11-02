import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { settings } from './ui';

const SHORT = 'e2e/fixtures/curto.webm';
const VIDEO = 'e2e/fixtures/fala-com-pausas.webm';
/** 31 arquivos de 1 s com nomes diferentes (o mesmo caminho repetido não vira 31 arquivos no seletor) */
const thirtyOne = () => { const buffer = readFileSync(SHORT); return Array.from({ length: 31 }, (_, i) => ({ name: `clipe-${i + 1}.webm`, mimeType: 'video/webm', buffer })); };

test('#154: the editor limits are shown before choosing, and 31 videos are caught before any work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('import-limits')).toContainText('até 30 vídeos, 3 min cada, 10 min somados');
  await expect(page.getByTestId('import-limits')).toContainText('fala em vários idiomas');
  await page.getByTestId('file-input').setInputFiles(thirtyOne());
  const warn = page.getByTestId('import-limit-warning');
  await expect(warn).toBeVisible({ timeout: 30_000 });
  await expect(warn).toBeFocused();
  await expect(page.getByTestId('import-limit-list')).toContainText('passa de 30 vídeos no projeto (M4F-106)');
  await expect(page.getByTestId('import-limit-budget')).toContainText('Cabem 30 de 31');
  // nada começou: sem perguntas e sem preparo
  await expect(page.getByTestId('setup-shell')).toHaveCount(0);
  await page.getByTestId('import-limit-continue').click();
  await expect(page.getByTestId('import-limit-warning')).toHaveCount(0);
  await expect(page.getByTestId('setup-shell')).toBeVisible();
});

test('#154: cancelling keeps the landing as it was', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(thirtyOne());
  await page.getByTestId('import-limit-cancel').click({ timeout: 30_000 });
  await expect(page.getByTestId('import-limit-warning')).toHaveCount(0);
  await expect(page.getByTestId('path-edit')).toBeVisible();
});

test('#152: the setup cards are a radio group: one Tab stop, arrows change the choice', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(VIDEO);
  await expect(page.getByTestId('setup-shell')).toBeVisible();
  const group = page.getByRole('radiogroup', { name: 'Destino do vídeo' });
  await expect(group).toBeVisible();
  const radios = group.getByRole('radio');
  await expect(radios).toHaveCount(6);
  await expect(group.locator('[aria-checked="true"]')).toHaveCount(1);
  await expect(group.locator('[tabindex="0"]')).toHaveCount(1);
  const first = group.locator('[aria-checked="true"]');
  const before = await first.getAttribute('aria-label');
  await first.focus();
  await page.keyboard.press('ArrowRight');
  const after = group.locator('[aria-checked="true"]');
  await expect(after).not.toHaveAttribute('aria-label', before!);
  await expect(after).toBeFocused();
  await page.keyboard.press('End');
  await expect(group.getByRole('radio', { name: 'Outro destino', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Home');
  await expect(radios.first()).toHaveAttribute('aria-checked', 'true');
});

test('#153: privacy says what leaves the computer now, per data type', async ({ page }) => {
  await page.goto('/');
  await settings(page, 'privacidade');
  await expect(page.getByTestId('privacy-video')).toHaveAttribute('data-state', 'local');
  await expect(page.getByTestId('privacy-audio')).toHaveAttribute('data-state', 'local');
  await expect(page.getByTestId('privacy-text')).toHaveAttribute('data-state', 'local');
  await expect(page.getByTestId('settings-screen')).not.toContainText('nunca saem deste computador');
  // escolher a API de transcrição sem chave: o áudio fica parado, nada é enviado
  await settings(page, 'transcricao');
  await page.getByTestId('asr-kind-api').check();
  await settings(page, 'privacidade');
  await expect(page.getByTestId('privacy-audio')).toHaveAttribute('data-state', 'blocked');
  await expect(page.getByTestId('privacy-audio')).toContainText('nada é enviado');
  await expect(page.getByTestId('privacy-video')).toHaveAttribute('data-state', 'local');
});

test('transcription language can be chosen independently of the UI and persists after reopening settings', async ({ page }) => {
  await page.goto('/');
  await settings(page, 'transcricao');
  await expect(page.getByTestId('asr-language-auto')).toBeChecked();
  await page.getByTestId('asr-language-en').check();
  await expect(page.getByTestId('asr-language-en')).toBeChecked();
  await settings(page, 'privacidade');
  await settings(page, 'transcricao');
  await expect(page.getByTestId('asr-language-en')).toBeChecked();
  await page.getByTestId('asr-language-pt').check();
  await expect(page.getByTestId('asr-language-pt')).toBeChecked();
});

test('#153: the landing does not promise that audio never leaves when the API route is authorized', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('m4f-asr', JSON.stringify({ kind: 'api', provider: 'groq', model: 'whisper-large-v3-turbo', audioConsent: ['groq'], fallbackLocal: true })));
  await page.goto('/');
  // sem chave aberta nesta aba, nada sai: a promessa padrão continua verdadeira
  await expect(page.getByTestId('privacy-promise')).toContainText('a não ser que você ligue a transcrição por API');
  await expect(page.locator('body')).not.toContainText('Nenhum envio de vídeo ou áudio ·');
});

test('#156: the editor code is not downloaded on the first screen', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()); });
  await page.goto('/');
  await expect(page.getByTestId('path-edit')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(scripts.some((u) => /\/Editor-[^/]+\.js$/.test(u))).toBe(false);
  expect(scripts.some((u) => /\/ClipMaker-[^/]+\.js$/.test(u))).toBe(false);
});
