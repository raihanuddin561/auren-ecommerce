import 'server-only';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import type {
  AdminReviewFilterParams,
  AdminReviewsOverviewMetrics,
  AdminReviewsResult,
  ProductRatingStatsData,
  ReviewFilterParams,
  ReviewItem,
} from './types';
import * as service from './service';

// =============================================================================================
// Storefront Public Queries
// =============================================================================================

export async function getProductReviewsQuery(
  productId: string,
  params?: ReviewFilterParams,
): Promise<{ items: ReviewItem[]; total: number }> {
  return service.getProductReviews(productId, params);
}

export async function getProductRatingStatsQuery(
  productId: string,
): Promise<ProductRatingStatsData> {
  return service.getProductRatingStats(productId);
}

// =============================================================================================
// Admin Queries (Guarded by reviews.moderate)
// =============================================================================================

export async function getReviewsForAdminQuery(
  params?: AdminReviewFilterParams,
): Promise<AdminReviewsResult> {
  const staff = await requireStaff();
  assertPermission(staff, 'reviews.moderate');

  return service.listReviewsForAdmin(params);
}

export async function getAdminOverviewMetricsQuery(): Promise<AdminReviewsOverviewMetrics> {
  const staff = await requireStaff();
  assertPermission(staff, 'reviews.moderate');

  return service.getAdminOverviewMetrics();
}
