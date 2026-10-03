import 'server-only';
import { cookies } from 'next/headers';
import { auth, getSession } from './auth';
import { isProduction } from './env';
import { DomainError } from './errors';
import type { StaffContext } from './permissions';
import { STEP_UP_WINDOW_SECONDS } from './session-policy';
import { PURPOSE_PATTERN, signStepUp, verifyStepUp } from './step-up-token';

/**
 * Step-up authentication for sensitive staff actions (refunds, exports, role changes, stock
 * write-offs). Being signed in is not enough: the staff member must have re-entered their password
 * or authentication code within the last few minutes, in this very session.
 *
 *   const staff = await requireStaff();
 *   assertPermission(staff, 'orders.refund');
 *   await requireStepUp(staff, 'orders.refund');   // throws STEP_UP_REQUIRED; the UI then asks
 *
 * Confirmation is per purpose: confirming for `orders.refund` does not unlock a data export. The
 * token lives in a cookie bound to this session, so it also dies with the session. A copy of it is
 * useless without the session cookie, and expires after STEP_UP_WINDOW_SECONDS either way.
 * `confirmStepUp` (modules/identity) verifies the credential and calls `grantStepUp`.
 */
export const STEP_UP_COOKIE = isProduction ? '__Host-auren.step-up' : 'auren.step-up';

/** The signing secret Better Auth currently uses (the first of BETTER_AUTH_SECRETS when rotating). */
const currentSecret = async (): Promise<string> => (await auth.$context).secret;

/** Marks the current session as freshly re-authenticated. */
export async function grantStepUp(purpose: string): Promise<void> {
  if (!PURPOSE_PATTERN.test(purpose)) throw new DomainError('VALIDATION');
  const session = await getSession();
  if (!session) throw new DomainError('UNAUTHENTICATED');
  const token = signStepUp(await currentSecret(), {
    sessionId: session.session.id,
    userId: session.user.id,
    purpose,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  (await cookies()).set(STEP_UP_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: STEP_UP_WINDOW_SECONDS,
  });
}

/** True when this session re-authenticated for `purpose` within the step-up window. */
export async function hasRecentStepUp(purpose: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  const token = (await cookies()).get(STEP_UP_COOKIE)?.value;
  return verifyStepUp(await currentSecret(), token, {
    sessionId: session.session.id,
    userId: session.user.id,
    purpose,
    nowSeconds: Math.floor(Date.now() / 1000),
    windowSeconds: STEP_UP_WINDOW_SECONDS,
  });
}

/** Throws STEP_UP_REQUIRED unless `staff` re-authenticated for `purpose` recently in this session. */
export async function requireStepUp(staff: StaffContext, purpose: string): Promise<void> {
  const session = await getSession();
  if (!session || session.user.id !== staff.userId || !(await hasRecentStepUp(purpose))) {
    throw new DomainError('STEP_UP_REQUIRED');
  }
}

/** Ends the step-up state (for example after the sensitive action completed). */
export async function clearStepUp(): Promise<void> {
  (await cookies()).delete(STEP_UP_COOKIE);
}
