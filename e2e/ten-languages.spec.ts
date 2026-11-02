import { expect, test } from '@playwright/test';
import { editCaption, pickVideos } from './ui';
import { settings } from './ui';

/** v0.45.0: legendas nas escritas das 10 línguas mais faladas usam as fontes do app (não as do sistema). */
const SAMPLES = [
  { code: 'zh', text: '这是第一个技巧', family: 'Noto Sans SC' },
  { code: 'ar', text: 'هذه هي النصيحة الأولى', family: 'Noto Sans Arabic' },
  { code: 'ur', text: 'یہ پہلا مشورہ ہے', family: 'Noto Sans Arabic' },
  { code: 'hi', text: 'यह पहला सुझाव है', family: 'Noto Sans Devanagari' },
  { code: 'bn', text: 'এটি প্রথম পরামর্শ', family: 'Noto Sans Bengali' },
] as const;

for (const sample of SAMPLES) {
  test(`a ${sample.code} caption loads ${sample.family} and is drawn`, async ({ page }, info) => {
    const loadedFamilies = () => page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
    await page.goto('/');
    await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
    await expect(page.getByTestId('out-duration')).toBeVisible({ timeout: 60_000 });
    expect(await loadedFamilies()).not.toContain(sample.family);
    const ids = await page.evaluate(() => (window as any).__m4f.plan.captions.map((c: { id: string }) => c.id) as string[]);
    for (const id of ids) await editCaption(page, id, sample.text);
    await expect.poll(loadedFamilies, { timeout: 30_000 }).toContain(sample.family);
    await page.getByRole('slider', { name: 'Posição na prévia' }).fill('1');
    await page.getByTestId('player-canvas').screenshot({ path: info.outputPath(`${sample.code}.png`) });
  });
}

test('the spoken-language setting offers auto plus the 10 most spoken languages', async ({ page }) => {
  await page.goto('/');
  await settings(page, 'transcricao');
  const values = await page.locator('input[name="asr-speech-language"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(values).toEqual(['auto', 'en', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur']);
  await page.getByTestId('asr-language-hi').check();
  await page.reload();
  await settings(page, 'transcricao');
  await expect(page.getByTestId('asr-language-hi')).toBeChecked();
});
