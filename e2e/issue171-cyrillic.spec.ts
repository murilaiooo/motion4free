import { expect, test } from '@playwright/test';
import { editCaption, pickVideos } from './ui';

/** #171: legenda em russo usa letras cirílicas das fontes do app (não a fonte do sistema). */
test('a Russian caption loads the Cyrillic font files and is drawn', async ({ page }, info) => {
  // Conta as faces cirílicas carregadas (a rede pode vir do service worker offline, sem evento de request).
  const cyrillicFaces = () => page.evaluate(() => [...document.fonts].filter((f) => f.unicodeRange.includes('U+400') && f.status === 'loaded').length);
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
  expect(await cyrillicFaces()).toBe(0);
  const id = await page.evaluate(() => (window as any).__m4f.plan.captions[0].id as string);
  await editCaption(page, id, 'Привет, как дела?');
  await expect.poll(cyrillicFaces, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.getByRole('slider', { name: 'Posição na prévia' }).fill('1');
  await page.getByTestId('player-canvas').screenshot({ path: info.outputPath('russo.png') });
});
