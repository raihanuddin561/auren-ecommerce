import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { ensureOwnerAccount } from '@/lib/owner';
import { totp } from '../support/totp';
import { expect, test } from './fixtures';
import { expectNoAxeViolations } from './support/axe';

/**
 * The local demo admin path (SEED_DEMO_ADMIN): the seeded owner keeps a throwaway password and is
 * not forced to change it, but must still enrol an authenticator before reaching the console.
 * The password is generated here and is deliberately shorter than the normal minimum, so the test
 * also proves that sign-in does not reject a weak bootstrap password.
 */
test.describe('demo admin first run', () => {
  test('signs in, enrols two-factor with a generated code and reaches the console', async ({
    page,
  }) => {
    const email = `demo-${randomBytes(4).toString('hex')}@auren.test`;
    const password = randomBytes(4).toString('hex');
    await ensureOwnerAccount({ email, name: 'Demo Admin', password, keepPassword: true });

    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.19.${randomBytes(1)[0]}.9` });
    await page.goto('/admin/sign-in');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // No forced password change: straight to the authenticator setup.
    await expect(page).toHaveURL(/\/admin\/security$/);
    await expect(page.getByRole('heading', { name: 'Secure your account' })).toBeVisible();
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    // :visible skips the hidden streaming copy that React leaves in the DOM for a moment.
    await page.locator('input[name="password"]:visible').fill(password);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByAltText('Two-factor setup QR code')).toBeVisible();
    const secret = (await page.getByTestId('totp-manual-key').innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    await expectNoAxeViolations(page);
    await page.getByLabel('Authentication code').fill(totp(secret));
    await page.getByRole('button', { name: 'Turn on' }).click();

    await expect(page.getByText('Step 3 of 3')).toBeVisible();
    await page.getByLabel('I have saved these backup codes').check();
    await page.getByRole('button', { name: 'Continue to admin' }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test.afterAll(async () => {
    await db.$disconnect();
  });
});
