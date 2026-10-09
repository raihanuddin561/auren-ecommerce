'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { requireStepUp } from '@/lib/step-up';
import { APPROVAL_DECIDE_STEP_UP } from './schemas';
import { decideApprovalStaff } from './service';

const decideSchema = z
  .object({
    id: z.uuid(),
    decision: z.enum(['approved', 'rejected']),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

/**
 * A second person decides a high-value request (maker-checker, INV-A6). Needs approvals.decide and a
 * fresh step-up; the service refuses the person who asked, and an approval is good for one use.
 */
export async function decideApprovalAction(
  input: unknown,
): Promise<ActionResult<{ status: 'approved' | 'rejected' }>> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'approvals.decide');
    await requireStepUp(staff, APPROVAL_DECIDE_STEP_UP);
    const decided = await decideApprovalStaff(staff, {
      id: parsed.data.id,
      decision: parsed.data.decision,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    });
    revalidatePath('/admin/approvals');
    return ok({ status: decided.status as 'approved' | 'rejected' });
  } catch (error) {
    return toActionError(error);
  }
}
