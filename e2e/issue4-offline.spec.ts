import { expect, test } from '@playwright/test';
import { pickVideos } from './ui';

test('issue #4: app abre offline depois de cachear, mantém projeto OPFS sem rede', async ({ page, context }) => {
  test.setTimeout(150_000);
  await page.goto('/?asr=vazio&offline-test=1');
  await expect(page.getByTestId('file-input')).toBeVisible();

  await expect.poll(async () => page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller && !!ready.active;
  }), { timeout: 40_000 }).toBe(true);

  const precache = await page.evaluate(async () => {
    const keys = await caches.keys();
    const name = keys.find(key => key.startsWith('m4f-shell-'));
    if (!name) return null;
    const cache = await caches.open(name);
    return { name, urls: (await cache.keys()).map(req => req.url), estimate: await navigator.storage.estimate() };
  });
  expect(precache).not.toBeNull();
  expect(precache!.urls.some(url => url.endsWith('/index.html'))).toBe(true);
  expect(precache!.urls.some(url => /\.js$/.test(url))).toBe(true);
  expect(precache!.urls.every(url => new URL(url).origin === 'http://localhost:4173')).toBe(true);
  expect(precache!.urls.some(url => /video\.bin|\.mp4|openrouter|api\.openai/.test(url))).toBe(false);

  const first = await page.evaluate(() => performance.getEntriesByType('resource').length);
  await pickVideos(page, 'e2e/fixtures/clip-red.webm');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 60_000 });

  const pageErrors: string[] = [];
  const requestErrors: string[] = [];
  const badResponses: string[] = [];
  page.on('requestfailed', req => requestErrors.push(req.url() + ': ' + req.failure()?.errorText));
  page.on('console', msg => { if (msg.type() === 'error') pageErrors.push(msg.text()); });
  page.on('response', res => { if (res.status() >= 400) badResponses.push(res.status() + ': ' + res.url()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('player-canvas')).toBeVisible({ timeout: 20_000 });
  expect(pageErrors).toEqual([]);
  expect(requestErrors).toEqual([]);
  expect(badResponses).toEqual([]);
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 60_000 });
  const offline = await page.evaluate(async () => ({
    active: !!navigator.serviceWorker.controller,
    current: await (async () => {
      const root = await navigator.storage.getDirectory();
      const app = await root.getDirectoryHandle('motion4free');
      const file = await (await app.getFileHandle('state.json')).getFile();
      return JSON.parse(await file.text()).current as string | null;
    })(),
    resources: performance.getEntriesByType('resource').length,
    storage: await navigator.storage.estimate(),
  }));
  expect(offline.active).toBe(true);
  expect(offline.current).toMatch(/^p-/);
  console.log('ISSUE4_OFFLINE_EVIDENCE ' + JSON.stringify({
    appShellUrls: precache!.urls.length,
    storageBeforeBytes: precache!.estimate.usage,
    storageAfterBytes: offline.storage.usage,
    onlineResourcesInitial: first,
    offlineResources: offline.resources,
    serviceWorkerControlledOffline: offline.active,
    preservedProjectId: !!offline.current,
    caveat: 'short synthetic media; browser storage estimate is approximate; CDN models unavailable offline',
  }));
  await context.setOffline(false);
});
