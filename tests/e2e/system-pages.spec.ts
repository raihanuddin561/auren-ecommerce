import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';

test.describe('404 page', () => {
  test('answers with a real 404 inside the storefront shell', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: 'This page has stepped out', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });

  test('offers search and a way back, and passes the accessibility scan', async ({ page }) => {
    await page.goto('/no/such/place');
    await expect(page.getByRole('link', { name: 'Shop all' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the search form sends the query to the search page', async ({ page }) => {
    await page.goto('/no/such/place');
    await page.getByRole('searchbox', { name: 'Search the collection' }).fill('oxford shirt');
    await page.getByRole('searchbox', { name: 'Search the collection' }).press('Enter');
    await expect(page).toHaveURL(/\/search\?q=oxford(\+|%20)shirt$/);
  });

  test('has no horizontal scrolling on small screens', async ({ page }) => {
    await page.goto('/no/such/place');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('maintenance page', () => {
  test('is calm, reassuring, hidden from search and accessible', async ({ page }) => {
    await page.goto('/maintenance');
    await expect(
      page.getByRole('heading', { name: 'We are making a few refinements', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Orders you have already placed are unaffected')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Message the concierge' })).toHaveAttribute(
      'href',
      '/contact',
    );
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await expectNoAxeViolations(page);
  });
});
