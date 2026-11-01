import { pickVideos } from './ui';
﻿import { expect, test } from '@playwright/test';
test('Meus projetos no editor leva a lista visível e focada sem rolagem manual (#81)', async ({ page }) => {
  await page.goto('/');
  await pickVideos(page, 'e2e/fixtures/fala-com-pausas.webm');
  await expect(page.getByTestId('saved')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('menu-close').click();
  const heading = page.getByRole('heading', { name: 'Meus projetos' });
  await expect(heading).toBeInViewport({ ratio: 0.9 });
  await expect(heading).toBeFocused();
  await expect(page.getByTestId('projects')).toBeInViewport();
  await expect(page.locator('[data-testid^="project-p-"]')).toHaveCount(1);
});

