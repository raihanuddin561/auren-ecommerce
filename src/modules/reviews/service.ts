import 'server-only';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';
import type {
  AdminReviewFilterParams,
  AdminReviewsOverviewMetrics,
  AdminReviewsResult,
  ModerateReviewInput,
  ProductRatingStatsData,
  ReviewFilterParams,
  ReviewItem,
  SubmitReviewInput,
} from './types';

export async function submitReview(
  input: SubmitReviewInput,
  context?: { userId?: string | null; email?: string | null },
): Promise<ReviewItem> {
  const verifiedMatch = await repo.findDeliveredOrderItem(input.productId, {
    userId: context?.userId,
    email: context?.email || input.authorEmail,
  });

  const isVerified = Boolean(verifiedMatch);
  const orderItemId = input.orderItemId ?? verifiedMatch?.orderItemId;
  const sizePurchased = input.sizePurchased || verifiedMatch?.sizePurchased || undefined;

  const review = await repo.createReview(
    {
      ...input,
      sizePurchased,
    },
    {
      userId: context?.userId ?? null,
      isVerified,
      orderItemId,
      status: 'pending',
    },
  );

  return review;
}

export async function moderateReview(
  input: ModerateReviewInput,
  staffContext: { id: string; userId: string },
): Promise<ReviewItem> {
  const existing = await repo.getReviewById(input.reviewId);
  if (!existing) {
    throw new DomainError('NOT_FOUND', `Review with id ${input.reviewId} was not found`);
  }

  const updatedReview = await db.$transaction(async (tx) => {
    const updated = await repo.updateReviewStatus(
      input.reviewId,
      input.status,
      staffContext.id,
      input.moderationNote,
      tx,
    );

    await repo.recalculateProductRatingStats(existing.productId, tx);

    await audit(tx, {
      actorId: staffContext.userId,
      action: `review.${input.status}`,
      entity: 'review',
      entityId: input.reviewId,
      before: {
        status: existing.status,
        moderatedBy: null,
      },
      after: {
        status: input.status,
        moderatedBy: staffContext.id,
        moderationNote: input.moderationNote,
      },
    });

    return updated;
  });

  if (existing.productSlug) {
    revalidatePath(`/products/${existing.productSlug}`);
  }
  revalidatePath('/admin/reviews');

  return updatedReview;
}

export async function voteHelpful(reviewId: string): Promise<number> {
  const existing = await repo.getReviewById(reviewId);
  if (!existing || existing.status !== 'approved') {
    throw new DomainError('NOT_FOUND', 'Active review not found');
  }

  return repo.incrementHelpfulCount(reviewId);
}

export async function getProductReviews(
  productId: string,
  params?: ReviewFilterParams,
): Promise<{ items: ReviewItem[]; total: number }> {
  return repo.listApprovedReviewsByProductId(productId, params);
}

export async function getProductRatingStats(productId: string): Promise<ProductRatingStatsData> {
  return repo.getProductRatingStats(productId);
}

export async function listReviewsForAdmin(
  params?: AdminReviewFilterParams,
): Promise<AdminReviewsResult> {
  return repo.listReviewsForAdmin(params);
}

export async function getAdminOverviewMetrics(): Promise<AdminReviewsOverviewMetrics> {
  return repo.getAdminOverviewMetrics();
}
