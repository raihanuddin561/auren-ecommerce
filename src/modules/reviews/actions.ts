'use server';

import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { getSession } from '@/lib/auth';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { moderateReviewSchema, submitReviewSchema, voteHelpfulSchema } from './schemas';
import * as service from './service';

export async function submitReviewAction(
  rawInput: unknown,
): Promise<ActionResult<{ reviewId: string; isVerified: boolean; status: string }>> {
  try {
    const parsed = submitReviewSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const session = await getSession().catch(() => null);

    const review = await service.submitReview(parsed.data, {
      userId: session?.user?.id ?? null,
      email: session?.user?.email ?? parsed.data.authorEmail,
    });

    return ok({
      reviewId: review.id,
      isVerified: review.isVerified,
      status: review.status,
    });
  } catch (error) {
    return toActionError(error);
  }
}

export async function moderateReviewAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'reviews.moderate');

    const parsed = moderateReviewSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.moderateReview(parsed.data, {
      id: staff.id,
      userId: staff.userId,
    });

    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function voteHelpfulReviewAction(
  rawInput: unknown,
): Promise<ActionResult<{ helpfulCount: number }>> {
  try {
    const parsed = voteHelpfulSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const helpfulCount = await service.voteHelpful(parsed.data.reviewId);
    return ok({ helpfulCount });
  } catch (error) {
    return toActionError(error);
  }
}
