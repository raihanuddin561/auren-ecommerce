import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from './auth';
import { db } from './db';
import { DomainError } from './errors';
import { toPermissionSet, type StaffContext, type StaffRole } from './permissions';
import { BYPASS_STAFF, isStaffBypassAllowed, isStaffBypassConfigured } from './test-bypass';

export const ADMIN_SIGN_IN_PATH = '/admin/sign-in';
export const ADMIN_SECURITY_PATH = '/admin/security';

export type StaffResolution =
  | { status: 'anonymous' }
  | { status: 'not_staff' }
  | { status: 'two_factor_required'; staff: StaffContext }
  | { status: 'ok'; staff: StaffContext };

interface StaffRecords {
  user: { id: string; name: string; email: string; banned: boolean; twoFactorEnabled: boolean };
  member: { id: string; role: StaffRole; active: boolean } | null;
  permissions: readonly string[];
}

/**
 * Pure decision: who is this user to the admin console? Staff must be active, not banned, and
 * have two-factor authentication enabled before any permission applies (ADR-003).
 */
export function resolveStaff({ user, member, permissions }: StaffRecords): StaffResolution {
  if (!member || !member.active || user.banned) return { status: 'not_staff' };
  const staff: StaffContext = {
    id: member.id,
    userId: user.id,
    role: member.role,
    name: user.name,
    email: user.email,
    permissions: toPermissionSet(permissions),
  };
  return user.twoFactorEnabled ? { status: 'ok', staff } : { status: 'two_factor_required', staff };
}

/** Loads the current request's staff identity. Deduplicated per request. */
export const getStaff = cache(async (): Promise<StaffResolution> => {
  // Test-only (see lib/test-bypass.ts): lets browser tests render admin screens without a database.
  if (isStaffBypassConfigured() && isStaffBypassAllowed(await headers())) {
    return { status: 'ok', staff: BYPASS_STAFF };
  }

  const session = await getSession();
  if (!session) return { status: 'anonymous' };

  const member = await db.staffMember.findUnique({
    where: { userId: session.user.id },
    select: { id: true, role: true, active: true },
  });
  const permissions = member
    ? (
        await db.rolePermission.findMany({
          where: { role: member.role },
          select: { permission: true },
        })
      ).map((row) => row.permission)
    : [];

  return resolveStaff({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      banned: Boolean(session.user.banned),
      twoFactorEnabled: Boolean(session.user.twoFactorEnabled),
    },
    member,
    permissions,
  });
});

/**
 * The signed-in, active, two-factor-protected staff member, or a redirect / FORBIDDEN.
 * Call it first in every admin layout, page, action and handler; then call assertPermission.
 */
export async function requireStaff(): Promise<StaffContext> {
  const resolution = await getStaff();
  if (resolution.status === 'anonymous') redirect(ADMIN_SIGN_IN_PATH);
  if (resolution.status === 'two_factor_required') redirect(ADMIN_SECURITY_PATH);
  if (resolution.status === 'not_staff') throw new DomainError('FORBIDDEN');
  return resolution.staff;
}

/**
 * For the security setup page only: staff who still need to enrol two-factor authentication.
 * Everyone else is sent to their usual place.
 */
export async function requireStaffPendingTwoFactor(): Promise<StaffContext> {
  const resolution = await getStaff();
  if (resolution.status === 'anonymous') redirect(ADMIN_SIGN_IN_PATH);
  if (resolution.status === 'not_staff') throw new DomainError('FORBIDDEN');
  return resolution.staff;
}
