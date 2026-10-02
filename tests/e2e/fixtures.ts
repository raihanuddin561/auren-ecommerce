import { test as base, type Browser, type Page } from '@playwright/test';
import { db } from '@/lib/db';
import type { StaffRole } from '@/lib/permissions';
import { TEST_PASSWORD, makeCustomer, makeStaff } from '../factories';

/**
 * Authenticated pages for E2E. Users are created straight in the database (the specs that use
 * these fixtures run only with E2E_WITH_DB=1), then signed in through the real Better Auth
 * endpoint so the session cookie is genuine.
 */
export interface StaffOptions {
  role?: StaffRole;
  /** Staff without two-factor are sent to the security setup page. Default true. */
  twoFactor?: boolean;
}

let addressCounter = Math.floor(Math.random() * 200);
const uniqueAddress = () =>
  `198.18.${process.pid % 250}.${(addressCounter = (addressCounter + 1) % 250) + 1}`;

async function pageSignedInAs(
  browser: Browser,
  baseURL: string,
  credentials: { email: string; password: string },
  afterSignIn?: () => Promise<void>,
): Promise<Page> {
  const api = await browser.newContext({ baseURL });
  const response = await api.request.post('/api/auth/sign-in/email', {
    data: credentials,
    // Each sign-in gets its own address, so fixtures never share a rate-limit bucket.
    headers: { origin: baseURL, 'x-forwarded-for': uniqueAddress() },
  });
  if (!response.ok()) throw new Error(`fixture sign-in failed: ${response.status()}`);
  // Staff are flagged as two-factor protected only after the session exists: the fixture has no
  // authenticator app, and the sign-in endpoint would otherwise demand a code.
  await afterSignIn?.();
  const storageState = await api.storageState();
  await api.close();
  const context = await browser.newContext({ baseURL, storageState });
  return context.newPage();
}

export const test = base.extend<{
  customerPage: Page;
  staffPage: (options?: StaffOptions) => Promise<Page>;
}>({
  customerPage: async ({ browser, baseURL }, provide) => {
    const { email, password } = await makeCustomer();
    const page = await pageSignedInAs(browser, baseURL!, { email, password });
    await provide(page);
    await page.context().close();
  },

  staffPage: async ({ browser, baseURL }, provide) => {
    const opened: Page[] = [];
    await provide(async (options = {}) => {
      const staff = await makeStaff({ role: options.role, twoFactor: false });
      const page = await pageSignedInAs(
        browser,
        baseURL!,
        { email: staff.email, password: staff.password ?? TEST_PASSWORD },
        async () => {
          if (options.twoFactor ?? true) {
            await db.user.update({
              where: { id: staff.user.id },
              data: { twoFactorEnabled: true },
            });
          }
        },
      );
      opened.push(page);
      return page;
    });
    for (const page of opened) await page.context().close();
  },
});

export { expect } from '@playwright/test';
