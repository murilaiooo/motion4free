import { expect, test } from '@playwright/test';

type Sample = {
  navigationMs: number;
  sameOriginCount: number;
  transferredBytesReported: number;
  decodedBytesReported: number;
  cacheName: string | null;
  quotaUsageBytes: number | null;
};

async function snapshot(page: import('@playwright/test').Page): Promise<Sample> {
  return page.evaluate(async () => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const sameOrigin = resources.filter(r => new URL(r.name).origin === location.origin);
    const keys = await caches.keys();
    const estimate = await navigator.storage.estimate();
    return {
      navigationMs: nav?.duration ?? -1,
      sameOriginCount: sameOrigin.length,
      transferredBytesReported: sameOrigin.reduce((sum, r) => sum + r.transferSize, 0),
      decodedBytesReported: sameOrigin.reduce((sum, r) => sum + r.decodedBodySize, 0),
      cacheName: keys.find(name => name.startsWith('m4f-shell-')) ?? null,
      quotaUsageBytes: estimate.usage ?? null,
    };
  });
}

test('issue #4: mede carregamento inicial, reabertura e offline no mesmo perfil', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto('/?asr=vazio&offline-test=1');
  await expect(page.getByTestId('file-input')).toBeVisible({ timeout: 30_000 });
  const cold = await snapshot(page);
  await expect.poll(async () => page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller;
  }), { timeout: 35_000 }).toBe(true);
  await page.reload();
  await expect(page.getByTestId('file-input')).toBeVisible({ timeout: 30_000 });
  const warm = await snapshot(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('file-input')).toBeVisible({ timeout: 30_000 });
  const offline = await snapshot(page);
  expect(cold.sameOriginCount).toBeGreaterThan(0);
  expect(warm.cacheName).toMatch(/^m4f-shell-/);
  expect(offline.cacheName).toBe(warm.cacheName);
  console.log('ISSUE4_LOAD_MEASUREMENTS ' + JSON.stringify({
    cold, warm, offline,
    caveat: 'navigation.duration and resource transferSize from browser performance API; approximate, browser-dependent, no measured full RAM/total network/CI benchmarks',
  }));
  await context.setOffline(false);
});
