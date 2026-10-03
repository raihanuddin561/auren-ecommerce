import 'server-only';
import { headers } from 'next/headers';
import { beginAttempt, clearFailures } from '@/lib/attempts';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { getRequestMeta } from '@/lib/request-meta';
import { audit } from '@/modules/audit/service';
import type { ConfirmStepUpInput } from './schemas';

/**
 * Checks the signed-in user's own credential. Only wrong answers count: after a few, each retry
 * has to wait longer (up to 15 minutes), so a stolen session cannot be used to guess the password
 * or the authenticator code, and a correct answer resets the counter. Better Auth's own lockout
 * does not apply when a session already exists, hence this separate counter.
 */
export async function verifyOwnCredential(
  identity: { staffId: string; userId: string },
  input: ConfirmStepUpInput,
): Promise<void> {
  const { staffId, userId } = identity;
  const status = await beginAttempt('stepUp', userId);
  if (status.blocked) {
    await recordSecurityEvent(staffId, userId, 'staff.step_up_blocked', { method: input.method });
    throw new DomainError(
      'RATE_LIMITED',
      `Too many wrong answers. Try again in ${Math.ceil(status.retryAfterSeconds / 60)} minute(s).`,
    );
  }

  const requestHeaders = await headers();
  try {
    if (input.method === 'password') {
      await auth.api.verifyPassword({
        headers: requestHeaders,
        body: { password: input.password },
      });
    } else {
      await auth.api.verifyTOTP({ headers: requestHeaders, body: { code: input.code } });
    }
  } catch {
    await recordSecurityEvent(staffId, userId, 'staff.step_up_failed', { method: input.method });
    throw new DomainError(
      'UNAUTHENTICATED',
      input.method === 'password'
        ? 'That password is not correct.'
        : 'That code is not correct or has expired.',
    );
  }
  await clearFailures('stepUp', userId);
}

/** Writes one security event for a staff member (never includes the secret that was entered). */
export async function recordSecurityEvent(
  staffId: string,
  userId: string,
  action: string,
  detail?: Record<string, string>,
): Promise<void> {
  const meta = await getRequestMeta();
  await db.$transaction((tx) =>
    audit(tx, {
      actorId: userId,
      action,
      entity: 'staff_member',
      entityId: staffId,
      ...(detail ? { after: detail } : {}),
      ip: meta.ip,
      userAgent: meta.userAgent,
    }),
  );
}

/** Signs the current user out of every device, including this one. */
export async function revokeAllSessions(options: {
  staffId?: string;
  userId: string;
}): Promise<void> {
  // Audit first: once the sessions are gone there is no one left to retry a failed audit write.
  if (options.staffId) {
    await recordSecurityEvent(options.staffId, options.userId, 'staff.sessions_revoked');
  }
  await auth.api.revokeSessions({ headers: await headers() });
}
