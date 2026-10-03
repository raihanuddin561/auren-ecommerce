import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

/**
 * Real sign-in and role checks for the console frame and the style guide. Needs PostgreSQL
 * (E2E_WITH_DB=1). The bypass-based specs cover the rendering without a database.
 */

test.describe('console navigation follows the staff role', () => {
  test('an order verifier sees the verification queue but not finance or staff screens', async ({
    staffPage,
    isMobile,
  }) => {
    test.skip(isMobile, 'the sidebar is a drawer on small screens');
    const page = await staffPage({ role: 'order_verifier' });
    await page.goto('/admin');
    const nav = page.getByRole('navigation', { name: 'Admin' });
    await expect(nav.getByText('Verification queue')).toBeVisible();
    await expect(nav.getByText('Finance')).toHaveCount(0);
    await expect(nav.getByText('Staff')).toHaveCount(0);
  });

  test('the owner sees every section', async ({ staffPage, isMobile }) => {
    test.skip(isMobile, 'the sidebar is a drawer on small screens');
    const page = await staffPage({ role: 'owner' });
    await page.goto('/admin');
    const nav = page.getByRole('navigation', { name: 'Admin' });
    for (const label of ['Verification queue', 'Finance', 'Staff', 'Audit log', 'Style guide']) {
      await expect(nav.getByText(label)).toBeVisible();
    }
  });
});

test.describe('style guide access', () => {
  test('is reachable by signed-in staff and passes the accessibility scan', async ({
    staffPage,
  }) => {
    const page = await staffPage({ role: 'content_editor' });
    await page.goto('/admin/style-guide');
    await expect(page.getByRole('heading', { name: 'Style guide', level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('sends visitors without a session to staff sign-in', async ({ page }) => {
    await page.goto('/admin/style-guide');
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Fstyle-guide$/);
  });

  test('is not available to customers', async ({ customerPage }) => {
    const response = await customerPage.goto('/admin/style-guide');
    expect(response?.status()).toBe(404);
    await expect(customerPage.getByRole('heading', { name: 'Style guide' })).toHaveCount(0);
  });
});
