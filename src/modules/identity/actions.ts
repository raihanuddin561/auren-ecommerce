'use server';

/**
 * @self-service Acts on the caller's own account only, so no permission applies; every action
 * authenticates the caller first.
 */

import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { getSession } from '@/lib/auth';
import { DomainError } from '@/lib/errors';
import { STEP_UP_WINDOW_SECONDS } from '@/lib/session-policy';
import { getStaff, requireStaff } from '@/lib/staff';
import { grantStepUp } from '@/lib/step-up';
import { confirmStepUpSchema } from './schemas';
import * as identityService from './service';

/**
 * Re-authenticates the signed-in staff member (password or authenticator code) and opens a short
 * step-up window for sensitive actions in this session.
 */
export async function confirmStepUp(
  input: unknown,
): Promise<ActionResult<{ validForSeconds: number }>> {
  const parsed = confirmStepUpSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    await identityService.verifyOwnCredential(
      { staffId: staff.id, userId: staff.userId },
      parsed.data,
    );
    // Audit first: a step-up that cannot be recorded is not granted.
    await identityService.recordSecurityEvent(staff.id, staff.userId, 'staff.step_up', {
      method: parsed.data.method,
      purpose: parsed.data.purpose,
    });
    await grantStepUp(parsed.data.purpose);
    return ok({ validForSeconds: STEP_UP_WINDOW_SECONDS });
  } catch (error) {
    return toActionError(error);
  }
}

/** Signs the current user out of every device. Works for staff and customers. */
export async function signOutEverywhere(): Promise<ActionResult<{ signedOut: true }>> {
  try {
    const session = await getSession();
    if (!session) throw new DomainError('UNAUTHENTICATED');
    const resolution = await getStaff();
    const staffId =
      resolution.status === 'anonymous' || resolution.status === 'not_staff'
        ? undefined
        : resolution.staff.id;
    await identityService.revokeAllSessions({
      userId: session.user.id,
      ...(staffId ? { staffId } : {}),
    });
    return ok({ signedOut: true });
  } catch (error) {
    return toActionError(error);
  }
}
