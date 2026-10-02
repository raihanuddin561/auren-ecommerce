import { db } from '@/lib/db';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

test.describe('staff access with a real session', () => {
  test('lets a two-factor protected staff member into the console', async ({ staffPage }) => {
    const page = await staffPage({ role: 'order_verifier' });
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('order verifier')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('sends staff who have not enabled two-factor to the security setup', async ({
    staffPage,
  }) => {
    const page = await staffPage({ twoFactor: false });
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/security$/);
    await expect(page.getByRole('heading', { name: 'Secure your account' })).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('shows customers an access message instead of the console', async ({ customerPage }) => {
    await customerPage.goto('/admin');
    await expect(customerPage.getByRole('heading', { name: /do not have access/i })).toBeVisible();
    await expect(customerPage.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('signs out and returns to staff sign-in', async ({ staffPage }) => {
    const page = await staffPage();
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });

  test('rejects a wrong password with a readable message', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': '198.19.0.77' });
    await page.goto('/admin/sign-in');
    await page.getByLabel('Email').fill('nobody@auren.test');
    await page.getByLabel('Password').fill('Not-the-password-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).not.toBeEmpty();
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });
});
