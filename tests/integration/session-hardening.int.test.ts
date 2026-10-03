import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clearLoggedEmails, getLoggedEmails } from '@/lib/email';
import { ensureOwnerAccount } from '@/lib/owner';
import { CUSTOMER_SESSION_SECONDS, STAFF_SESSION_MAX_SECONDS } from '@/lib/session-policy';
import { TEST_PASSWORD, makeCustomer, makeStaff } from '../factories';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  clearLoggedEmails();
});
afterAll(closeDatabase);

/** Signs in and returns the session cookie header a browser would send back. */
async function signIn(email: string, password = TEST_PASSWORD) {
  const response = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  return { cookie: new Headers({ cookie }), user: response.response.user };
}

const sessionsOf = (userId: string) => db.session.findMany({ where: { userId } });

describe('sessions end when the password changes', () => {
  it('revokes every session on a password reset', async () => {
    const { email, user } = await makeCustomer();
    await signIn(email);
    await signIn(email);
    expect(await sessionsOf(user.id)).toHaveLength(2);

    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset' } });
    for (let i = 0; i < 50 && getLoggedEmails().length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const mail = getLoggedEmails().findLast((m) => m.to === email)!;
    const token = new URL(/https?:\/\/\S+/.exec(mail.text)![0]).pathname.split('/').pop()!;
    await auth.api.resetPassword({ body: { newPassword: 'Brand-new-passphrase-7', token } });

    expect(await sessionsOf(user.id)).toHaveLength(0);
  });

  it('revokes every other session on a password change, even when the client does not ask', async () => {
    const { email, user } = await makeCustomer();
    const thisDevice = await signIn(email);
    const otherDevice = await signIn(email);
    expect(await sessionsOf(user.id)).toHaveLength(2);

    await auth.api.changePassword({
      headers: thisDevice.cookie,
      body: {
        currentPassword: TEST_PASSWORD,
        newPassword: 'Another-strong-passphrase-3',
        revokeOtherSessions: false,
      },
    });

    // The stolen/other device is signed out; the caller gets a fresh session.
    expect(await auth.api.getSession({ headers: otherDevice.cookie })).toBeNull();
    expect(await sessionsOf(user.id)).toHaveLength(1);
  });
});

describe('first owner must replace the bootstrap password', () => {
  it('flags the owner on creation and clears the flag only when the password is changed', async () => {
    await ensureOwnerAccount({
      email: 'owner@auren.test',
      name: 'Store Owner',
      password: TEST_PASSWORD,
    });
    const owner = await signIn('owner@auren.test');
    expect(await db.user.findUniqueOrThrow({ where: { email: 'owner@auren.test' } })).toMatchObject(
      {
        mustChangePassword: true,
      },
    );

    await auth.api.changePassword({
      headers: owner.cookie,
      body: { currentPassword: TEST_PASSWORD, newPassword: 'Owner-chosen-passphrase-5' },
    });
    expect(await db.user.findUniqueOrThrow({ where: { email: 'owner@auren.test' } })).toMatchObject(
      {
        mustChangePassword: false,
      },
    );
  });

  it('does not clear the flag when the current password was wrong', async () => {
    await ensureOwnerAccount({
      email: 'owner@auren.test',
      name: 'Store Owner',
      password: TEST_PASSWORD,
    });
    const owner = await signIn('owner@auren.test');
    await expect(
      auth.api.changePassword({
        headers: owner.cookie,
        body: { currentPassword: 'Wrong-password-1', newPassword: 'Owner-chosen-passphrase-5' },
      }),
    ).rejects.toBeTruthy();
    expect(await db.user.findUniqueOrThrow({ where: { email: 'owner@auren.test' } })).toMatchObject(
      {
        mustChangePassword: true,
      },
    );
  });
});

describe('session lifetime', () => {
  const secondsBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 1000);

  it('caps staff sessions at the absolute limit and keeps customers at thirty days', async () => {
    const staff = await makeStaff({ role: 'support', twoFactor: false });
    const customer = await makeCustomer();
    await signIn(staff.email);
    await signIn(customer.email);

    const [staffSession] = await sessionsOf(staff.user.id);
    const [customerSession] = await sessionsOf(customer.user.id);
    expect(secondsBetween(staffSession!.expiresAt, staffSession!.createdAt)).toBeLessThanOrEqual(
      STAFF_SESSION_MAX_SECONDS + 5,
    );
    expect(secondsBetween(customerSession!.expiresAt, customerSession!.createdAt)).toBeGreaterThan(
      CUSTOMER_SESSION_SECONDS - 5,
    );
  });

  it('does not slide: using a session never extends it', async () => {
    const staff = await makeStaff({ role: 'support', twoFactor: false });
    const { cookie } = await signIn(staff.email);
    const [before] = await sessionsOf(staff.user.id);
    // Pretend the session was created an hour ago, which is past any refresh threshold.
    const earlier = new Date(Date.now() - 3_600_000);
    await db.session.update({
      where: { id: before!.id },
      data: { createdAt: earlier, updatedAt: earlier },
    });
    const stored = await db.session.findUniqueOrThrow({ where: { id: before!.id } });

    expect(await auth.api.getSession({ headers: cookie })).not.toBeNull();
    const [after] = await sessionsOf(staff.user.id);
    expect(after!.expiresAt.getTime()).toBe(stored.expiresAt.getTime());
  });

  it('rejects a staff session whose stored expiry has passed', async () => {
    const staff = await makeStaff({ role: 'support', twoFactor: false });
    const { cookie } = await signIn(staff.email);
    await db.session.updateMany({
      where: { userId: staff.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await auth.api.getSession({ headers: cookie })).toBeNull();
  });
});

describe('tokens at rest', () => {
  it('stores password reset identifiers hashed, not as the bearer token', async () => {
    const { email } = await makeCustomer();
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset' } });
    for (let i = 0; i < 50 && getLoggedEmails().length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const mail = getLoggedEmails().findLast((m) => m.to === email)!;
    const token = new URL(/https?:\/\/\S+/.exec(mail.text)![0]).pathname.split('/').pop()!;
    const rows = await db.verification.findMany();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.identifier).not.toContain(token);
  });

  it('is configured to encrypt provider tokens and rotate secrets without logging users out', () => {
    expect(auth.options.account?.encryptOAuthTokens).toBe(true);
    expect(auth.options.verification?.storeIdentifier).toBe('hashed');
    expect(auth.options.session?.disableSessionRefresh).toBe(true);
  });
});
