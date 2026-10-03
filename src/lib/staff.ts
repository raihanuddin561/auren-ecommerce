import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getSession } from './auth';
import { db } from './db';
import { DomainError } from './errors';
import { env } from './env';
import { ipAllowed, PRIVILEGED_ROLES } from './ip-allowlist';
import { logger } from './logger';
import {
  hasPermission,
  toPermissionSet,
  type Permission,
  type StaffContext,
  type StaffRole,
} from './permissions';
import { requestIp } from './request-meta';
import { staffSessionTooOld } from './session-policy';
import { BYPASS_STAFF, isStaffBypassAllowed, isStaffBypassConfigured } from './test-bypass';

export const ADMIN_SIGN_IN_PATH = '/admin/sign-in';
export const ADMIN_SECURITY_PATH = '/admin/security';

export type StaffResolution =
  | { status: 'anonymous' }
  | { status: 'not_staff' }
  | { status: 'password_change_required'; staff: StaffContext }
  | { status: 'two_factor_required'; staff: StaffContext }
  | { status: 'ok'; staff: StaffContext };

interface StaffRecords {
  user: {
    id: string;
    name: string;
    email: string;
    banned: boolean;
    twoFactorEnabled: boolean;
    mustChangePassword: boolean;
  };
  member: { id: string; role: StaffRole; active: boolean } | null;
  permissions: readonly string[];
  /** When the current session was created; staff sessions have an absolute lifetime. */
  sessionCreatedAt: Date | null;
  now?: Date;
  /** Where the request came from; with an allowlist configured, owner and finance must match. */
  network?: { ip: string | null; allowlist: string | undefined };
}

/**
 * Pure decision: who is this user to the admin console? Staff must be active, not banned, inside
 * their session's absolute lifetime, off the bootstrap password and enrolled in two-factor
 * authentication before any permission applies (ADR-003).
 */
export function resolveStaff({
  user,
  member,
  permissions,
  sessionCreatedAt,
  now = new Date(),
  network,
}: StaffRecords): StaffResolution {
  if (!member || !member.active || user.banned) return { status: 'not_staff' };
  // Optional network restriction for the most powerful roles: from anywhere else they are simply
  // not staff (a 404), exactly like a customer.
  if (
    network &&
    (PRIVILEGED_ROLES as readonly string[]).includes(member.role) &&
    !ipAllowed(network.ip, network.allowlist)
  ) {
    logger.warn({ userId: user.id, role: member.role }, 'privileged role outside the IP allowlist');
    return { status: 'not_staff' };
  }
  // A missing or unreadable creation time is treated as expired: fail closed.
  if (!sessionCreatedAt || Number.isNaN(sessionCreatedAt.getTime())) {
    logger.warn(
      { userId: user.id },
      'staff session has no usable creation time; treating as expired',
    );
    return { status: 'anonymous' };
  }
  if (staffSessionTooOld(sessionCreatedAt, now)) return { status: 'anonymous' };
  const staff: StaffContext = {
    id: member.id,
    userId: user.id,
    role: member.role,
    name: user.name,
    email: user.email,
    permissions: toPermissionSet(permissions),
  };
  if (user.mustChangePassword) return { status: 'password_change_required', staff };
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
      mustChangePassword: Boolean(session.user.mustChangePassword),
    },
    sessionCreatedAt: session.session.createdAt ? new Date(session.session.createdAt) : null,
    network: { ip: requestIp(await headers()), allowlist: env.PRIVILEGED_IP_ALLOWLIST },
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
  if (
    resolution.status === 'password_change_required' ||
    resolution.status === 'two_factor_required'
  ) {
    redirect(ADMIN_SECURITY_PATH);
  }
  if (resolution.status === 'not_staff') throw new DomainError('FORBIDDEN');
  return resolution.staff;
}

/**
 * requireStaff plus a permission check for console pages: staff without the permission get the same
 * 404 as anyone else, so a screen they cannot use does not announce itself.
 */
export async function requireStaffWith(permission: Permission): Promise<StaffContext> {
  const staff = await requireStaff();
  if (!hasPermission(staff, permission)) notFound();
  return staff;
}

/**
 * For the security setup page only: staff who still need to choose a password or enrol two-factor
 * authentication.
 * Everyone else is sent to their usual place.
 */
export async function requireStaffPendingSecurity(): Promise<StaffContext> {
  const resolution = await getStaff();
  if (resolution.status === 'anonymous') redirect(ADMIN_SIGN_IN_PATH);
  if (resolution.status === 'not_staff') throw new DomainError('FORBIDDEN');
  return resolution.staff;
}
