import { expect, test } from '@playwright/test';
import { settings } from './ui';

/** #170: medições reais ficam neste navegador, aparecem em Transcrição e o relatório é copiável sem texto da pessoa. */
test('performance panel lists stored measurements, copies the report and deletes them', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await settings(page, 'transcricao');
  await expect(page.getByTestId('perf-empty')).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('m4f.perf.v1', JSON.stringify([
      { kind: 'asr', at: '2026-11-02T20:00:00.000Z', model: 'turbo-webgpu', device: 'webgpu', check: false, language: 'auto', speechSec: 120, loadSec: 8, inferSec: 30, cached: true, fallbacks: 0 },
      { kind: 'llm', at: '2026-11-02T20:01:00.000Z', model: 'forte', loadSec: null, promptTokens: 900, replyTokens: 120, prefillPerSec: 450, decodePerSec: 38, totalSec: 5 },
      { kind: 'asr', broken: true },
    ]));
  });
  await page.reload();
  await settings(page, 'transcricao');
  const list = page.getByTestId('perf-list');
  await expect(list.locator('li')).toHaveCount(2);
  await expect(list.locator('[data-perf-kind="asr"]')).toContainText('4×');
  await page.getByTestId('perf-copy').click();
  const report = await page.evaluate(() => navigator.clipboard.readText());
  expect(report).toContain('Motion4Free performance report');
  expect(report).toContain('turbo-webgpu | webgpu | main | auto | 120 | 8 | 30 | 4 |');
  expect(report).toContain('forte | - | 900 | 120 | 450 | 38 | 5 |');
  await page.getByTestId('perf-clear').click();
  await expect(page.getByTestId('perf-empty')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('m4f.perf.v1'))).toBe('[]');
});
