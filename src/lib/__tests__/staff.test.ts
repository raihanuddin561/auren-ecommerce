import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { auth } from '../auth';
import { db } from '../db';
import { getStaff, requireStaff, requireStaffPendingTwoFactor, resolveStaff } from '../staff';

const user = {
  id: 'u1',
  name: 'Ayesha Rahman',
  email: 'ayesha@auren.local',
  banned: false,
  twoFactorEnabled: true,
};
const member = { id: 'm1', role: 'order_verifier' as const, active: true };

describe('resolveStaff', () => {
  it('grants an active, two-factor protected staff member their role permissions', () => {
    const result = resolveStaff({ user, member, permissions: ['orders.verify', 'unknown.thing'] });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.staff.role).toBe('order_verifier');
    expect([...result.staff.permissions]).toEqual(['orders.verify']);
  });

  it('requires two-factor authentication before any access', () => {
    const result = resolveStaff({
      user: { ...user, twoFactorEnabled: false },
      member,
      permissions: ['orders.verify'],
    });
    expect(result.status).toBe('two_factor_required');
  });

  it('treats customers, deactivated staff and blocked users as not staff', () => {
    expect(resolveStaff({ user, member: null, permissions: [] }).status).toBe('not_staff');
    expect(
      resolveStaff({ user, member: { ...member, active: false }, permissions: [] }).status,
    ).toBe('not_staff');
    expect(resolveStaff({ user: { ...user, banned: true }, member, permissions: [] }).status).toBe(
      'not_staff',
    );
  });
});

describe('requireStaff', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const signedIn = (overrides = {}) =>
    vi.spyOn(auth.api, 'getSession').mockResolvedValue({
      session: { id: 's1' },
      user: { ...user, ...overrides },
    } as never);

  const stubDb = (found: typeof member | null, grants: string[] = []) => {
    vi.spyOn(db.staffMember, 'findUnique').mockResolvedValue(found as never);
    vi.spyOn(db.rolePermission, 'findMany').mockResolvedValue(
      grants.map((permission) => ({ permission })) as never,
    );
  };

  it('sends anonymous visitors to the admin sign-in page', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(null as never);
    await expect(requireStaff()).rejects.toMatchObject({
      digest: expect.stringContaining('/admin/sign-in'),
    });
  });

  it('sends staff without two-factor to the security setup page', async () => {
    signedIn({ twoFactorEnabled: false });
    stubDb(member, ['orders.verify']);
    await expect(requireStaff()).rejects.toMatchObject({
      digest: expect.stringContaining('/admin/security'),
    });
  });

  it('rejects a customer who is not staff with FORBIDDEN', async () => {
    signedIn();
    stubDb(null);
    await expect(requireStaff()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns the staff context for a fully authenticated staff member', async () => {
    signedIn();
    stubDb(member, ['orders.verify', 'orders.read']);
    const staff = await requireStaff();
    expect(staff).toMatchObject({ userId: 'u1', role: 'order_verifier' });
    expect(staff.permissions.has('orders.verify')).toBe(true);
  });

  it('lets staff who still need two-factor reach the setup page', async () => {
    signedIn({ twoFactorEnabled: false });
    stubDb(member);
    await expect(requireStaffPendingTwoFactor()).resolves.toMatchObject({ role: 'order_verifier' });
    expect((await getStaff()).status).toBe('two_factor_required');
  });
});
