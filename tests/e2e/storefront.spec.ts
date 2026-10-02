import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';

test.describe('storefront shell', () => {
  test('renders the landing page and passes the accessibility scan', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /refined menswear/i, level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/AUREN/);
    await expectNoAxeViolations(page);
  });

  test('does not leak the framework signature header', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });

  test('answers unknown routes with a real 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});
