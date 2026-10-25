import { expect, test } from '@playwright/test';

test('issue #2: notices of shipped fonts, icons and JS libraries are public in Brave', async ({ request, page }) => {
  for (const [file, expected] of [
    ['/licencas-fontes.txt', 'Noto Color Emoji'],
    ['/licencas-icones.txt', 'Lucide'],
    ['/licencas-bibliotecas.txt', 'mediabunny@1.61.6'],
  ] as const) {
    const response = await request.get(file);
    expect(response.status(), file).toBe(200);
    expect(await response.text()).toContain(expected);
  }
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('body')).toContainText('Motion4Free');
  expect(errors).toEqual([]);
});

test('issue #2: runtime notes identify MPL and Apache without pretending models are bundled', async ({ request }) => {
  const text = await (await request.get('/licencas-bibliotecas.txt')).text();
  expect(text).toContain('mediabunny@1.61.6 | SPDX MPL-2.0');
  expect(text).toContain('@huggingface/transformers@4.3.1 | SPDX Apache-2.0');
  expect(text).toContain('Modelos de IA são obtidos sob demanda');
  expect(text).toMatch(/não significa/i); // separate lockfile graph from published bundle
});
