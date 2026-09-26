import { expect, test } from '@playwright/test';

test('la web carga y el Worker responde health', async ({ page, request }) => {
  const health = await request.get('/api/v1/health');
  expect(health.ok()).toBe(true);

  await page.goto('/');
  await expect(page).toHaveTitle(/Wous/);
});
