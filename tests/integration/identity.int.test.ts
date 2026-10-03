import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clearLoggedEmails, getLoggedEmails } from '@/lib/email';
import { ensureOwnerAccount } from '@/lib/owner';
import { assertPermission } from '@/lib/permissions';
import { getStaff, requireStaff } from '@/lib/staff';
import { TEST_PASSWORD, makeCustomer, makeStaff } from '../factories';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  clearLoggedEmails();
  vi.restoreAllMocks();
});
afterAll(closeDatabase);

/** Auth mail is sent in the background; wait until it shows up in the in-memory mailbox. */
async function nextEmail(to: string) {
  for (let i = 0; i < 50; i++) {
    const found = getLoggedEmails().findLast((mail) => mail.to === to);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`no email arrived for ${to}`);
}

const linkIn = (text: string) => /https?:\/\/\S+/.exec(text)?.[0] ?? '';

describe('email and password accounts', () => {
  it('signs up, verifies the email, then signs in', async () => {
    const email = 'rahim@auren.test';
    await auth.api.signUpEmail({ body: { email, password: TEST_PASSWORD, name: 'Rahim Uddin' } });

    await expect(
      auth.api.signInEmail({ body: { email, password: TEST_PASSWORD } }),
    ).rejects.toMatchObject({ status: 'FORBIDDEN' });

    const mail = await nextEmail(email);
    const token = new URL(linkIn(mail.text)).searchParams.get('token');
    expect(token).toBeTruthy();
    await auth.api.verifyEmail({ query: { token: token! } });

    const session = await auth.api.signInEmail({ body: { email, password: TEST_PASSWORD } });
    expect(session.user.email).toBe(email);
    expect(await db.session.count({ where: { userId: session.user.id } })).toBe(1);
  });

  it('rejects short passwords and wrong passwords', async () => {
    await expect(
      auth.api.signUpEmail({
        body: { email: 'short@auren.test', password: 'short', name: 'Short' },
      }),
    ).rejects.toBeTruthy();
    const { email } = await makeCustomer();
    await expect(
      auth.api.signInEmail({ body: { email, password: 'Not-the-password-1' } }),
    ).rejects.toBeTruthy();
  });

  it('resets a forgotten password with a one-time link', async () => {
    const { email } = await makeCustomer();
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset' } });
    const mail = await nextEmail(email);
    const token = new URL(linkIn(mail.text)).pathname.split('/').pop()!;

    await auth.api.resetPassword({ body: { newPassword: 'Brand-new-passphrase-7', token } });

    await expect(
      auth.api.signInEmail({ body: { email, password: TEST_PASSWORD } }),
    ).rejects.toBeTruthy();
    const session = await auth.api.signInEmail({
      body: { email, password: 'Brand-new-passphrase-7' },
    });
    expect(session.user.email).toBe(email);
    await expect(
      auth.api.resetPassword({ body: { newPassword: 'Another-passphrase-8', token } }),
    ).rejects.toBeTruthy();
  });

  it('does not start a session for a blocked customer', async () => {
    const { email, password } = await makeCustomer({ banned: true });
    await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toBeTruthy();
    expect(await db.session.count()).toBe(0);
  });

  it('never attaches a social login to a staff user', async () => {
    const { user } = await makeStaff();
    const hook = auth.options.databaseHooks?.account?.create?.before;
    const account = { userId: user.id, providerId: 'google', accountId: 'g-1' } as never;
    expect(await hook?.(account)).toBe(false);
    const { user: customer } = await makeCustomer();
    const allowed = await hook?.({
      userId: customer.id,
      providerId: 'google',
      accountId: 'g-2',
    } as never);
    expect(allowed).not.toBe(false);
  });
});

describe('staff access control', () => {
  const asSignedIn = (user: {
    id: string;
    name: string;
    email: string;
    banned?: boolean;
    twoFactorEnabled?: boolean;
  }) =>
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      session: { id: 's1', createdAt: new Date() },
      user: { banned: false, twoFactorEnabled: false, ...user },
    } as never);

  it('lets an order verifier through with the verification permission', async () => {
    const { user } = await makeStaff({ role: 'order_verifier' });
    asSignedIn({ ...user, twoFactorEnabled: true });
    const staff = await requireStaff();
    expect(staff.role).toBe('order_verifier');
    expect(() => assertPermission(staff, 'orders.verify')).not.toThrow();
    expect(() => assertPermission(staff, 'finance.read')).toThrowError(/FORBIDDEN/);
  });

  it('keeps fulfillment and finance staff away from order verification', async () => {
    for (const role of ['fulfillment', 'finance', 'content_editor'] as const) {
      const { user } = await makeStaff({ role });
      asSignedIn({ ...user, twoFactorEnabled: true });
      const staff = await requireStaff();
      expect(() => assertPermission(staff, 'orders.verify')).toThrowError(/FORBIDDEN/);
    }
  });

  it('honours edits the owner makes to role grants', async () => {
    const { user } = await makeStaff({ role: 'support' });
    asSignedIn({ ...user, twoFactorEnabled: true });
    await db.rolePermission.delete({
      where: { role_permission: { role: 'support', permission: 'orders.verify' } },
    });
    const staff = await requireStaff();
    expect(() => assertPermission(staff, 'orders.verify')).toThrowError(/FORBIDDEN/);
    await db.rolePermission.create({ data: { role: 'support', permission: 'orders.verify' } });
  });

  it('requires two-factor authentication before any staff access', async () => {
    const { user } = await makeStaff({ twoFactor: false });
    asSignedIn({ ...user, twoFactorEnabled: false });
    expect((await getStaff()).status).toBe('two_factor_required');
    await expect(requireStaff()).rejects.toMatchObject({
      digest: expect.stringContaining('/admin/security'),
    });
  });

  it('treats customers and deactivated staff as not staff', async () => {
    const { user: customer } = await makeCustomer();
    asSignedIn({ ...customer, twoFactorEnabled: true });
    expect((await getStaff()).status).toBe('not_staff');

    const { user: gone } = await makeStaff({ active: false });
    asSignedIn({ ...gone, twoFactorEnabled: true });
    await expect(requireStaff()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('owner bootstrap', () => {
  it('creates a verified owner who can sign in, then must enrol two-factor', async () => {
    const result = await ensureOwnerAccount({
      email: 'Owner@Auren.test',
      name: 'Store Owner',
      password: TEST_PASSWORD,
    });
    expect(result.created).toBe(true);

    const session = await auth.api.signInEmail({
      body: { email: 'owner@auren.test', password: TEST_PASSWORD },
    });
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      session: { id: 's1', createdAt: new Date() },
      user: { ...session.user, banned: false, twoFactorEnabled: false },
    } as never);
    // The bootstrap password must be replaced before anything else, including two-factor setup.
    expect(session.user.mustChangePassword).toBe(true);
    expect((await getStaff()).status).toBe('password_change_required');

    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      session: { id: 's1', createdAt: new Date() },
      user: { ...session.user, banned: false, twoFactorEnabled: false, mustChangePassword: false },
    } as never);
    const resolution = await getStaff();
    expect(resolution.status).toBe('two_factor_required');
    if (resolution.status === 'two_factor_required') expect(resolution.staff.role).toBe('owner');
  });

  it('is safe to run again', async () => {
    const input = { email: 'owner@auren.test', name: 'Store Owner', password: TEST_PASSWORD };
    const first = await ensureOwnerAccount(input);
    const second = await ensureOwnerAccount(input);
    expect(second).toEqual({ userId: first.userId, created: false });
    expect(await db.staffMember.count()).toBe(1);
    expect(await db.user.count()).toBe(1);
  });

  it('promotes an existing verified-by-staff customer account to owner without changing the password', async () => {
    const { user, email } = await makeCustomer({ emailVerified: false });
    const result = await ensureOwnerAccount({
      email,
      name: 'x',
      password: 'ignored-for-existing-1',
    });
    expect(result).toEqual({ userId: user.id, created: false });
    expect((await db.staffMember.findUniqueOrThrow({ where: { userId: user.id } })).role).toBe(
      'owner',
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(true);
  });
});
