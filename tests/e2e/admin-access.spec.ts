import { expect, test } from '@playwright/test';
import { expectNoAxeViolations } from './support/axe';

test.describe('admin entry for visitors without a session', () => {
  test('sends the visitor to staff sign-in and remembers the destination', async ({ page }) => {
    await page.goto('/admin/orders');
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Forders$/);
    await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
  });

  test('keeps admin pages out of search results', async ({ page }) => {
    await page.goto('/admin/sign-in');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('offers a labelled, keyboard friendly sign-in form that passes the accessibility scan', async ({
    page,
  }) => {
    await page.goto('/admin/sign-in');
    const email = page.getByLabel('Email');
    const password = page.getByLabel('Password');
    await expect(email).toBeVisible();
    await expect(password).toHaveAttribute('type', 'password');
    await email.focus();
    await page.keyboard.press('Tab');
    await expect(password).toBeFocused();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await expectNoAxeViolations(page);
  });
});
