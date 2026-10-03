import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';

/** Runs against the server started with the test-only staff bypass (no database). */
test.describe('account security page', () => {
  test('shows the password form and sign-out-everywhere, and passes the accessibility scan', async ({
    page,
  }) => {
    await page.goto('/admin/account');
    await expect(page.getByRole('heading', { name: 'Account security', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Current password')).toBeVisible();
    await expect(page.getByLabel(/^New password/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out of every device' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('checks the new password before asking the server', async ({ page }) => {
    await page.goto('/admin/account');
    await page.getByLabel('Current password').fill('Current-passphrase-1');
    await page.getByLabel(/^New password/).fill('short');
    await page.getByLabel('Confirm new password').fill('short');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'at least 10 characters' }),
    ).toBeVisible();

    await page.getByLabel(/^New password/).fill('A-much-longer-passphrase-2');
    await page.getByLabel('Confirm new password').fill('A-different-passphrase-3');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'do not match' })).toBeVisible();
  });

  test('is reachable from the account menu', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('link', { name: 'Account security' }).click();
    await expect(page).toHaveURL(/\/admin\/account$/);
  });
});
