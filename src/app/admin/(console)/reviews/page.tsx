import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ReviewsMetricStrip } from '@/components/admin/reviews/reviews-metric-strip';
import { ReviewsTable } from '@/components/admin/reviews/reviews-table';
import { getAdminOverviewMetricsQuery, getReviewsForAdminQuery } from '@/modules/reviews/queries';
import type { ReviewStatus } from '@/modules/reviews/types';
import { requireStaff } from '@/lib/staff';
import { assertPermission } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Customer Reviews Moderation | AUREN Admin',
};

interface ReviewsPageProps {
  searchParams: Promise<{
    status?: string;
    rating?: string;
    search?: string;
    page?: string;
  }>;
}

async function ReviewsContent({ searchParams }: ReviewsPageProps) {
  const staff = await requireStaff();
  assertPermission(staff, 'reviews.moderate');

  const params = await searchParams;
  const statusFilter = (params.status ?? 'all') as ReviewStatus | 'all';
  const ratingFilter = params.rating ? parseInt(params.rating, 10) : undefined;
  const pageFilter = params.page ? parseInt(params.page, 10) : 1;

  const [metrics, reviewsResult] = await Promise.all([
    getAdminOverviewMetricsQuery(),
    getReviewsForAdminQuery({
      status: statusFilter,
      rating: ratingFilter,
      search: params.search,
      page: pageFilter,
      pageSize: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="type-caption font-mono tracking-widest text-accent-text uppercase">
            Social Proof &amp; Client Feedback
          </span>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-fg md:text-3xl">
            Customer Reviews Moderation
          </h1>
          <p className="mt-1 type-body-sm text-fg-muted">
            Curate verified buyer testimonials, fit verdicts, and customer photography before
            publication.
          </p>
        </div>
      </div>

      <ReviewsMetricStrip metrics={metrics} />

      <ReviewsTable
        items={reviewsResult.items}
        totalCount={reviewsResult.total}
        currentPage={reviewsResult.page}
        totalPages={reviewsResult.totalPages}
        currentStatus={statusFilter}
        currentRating={ratingFilter}
        searchQuery={params.search}
      />
    </div>
  );
}

export default function ReviewsPage(props: ReviewsPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-fg-muted">
          <p className="type-body-sm">Loading reviews queue...</p>
        </div>
      }
    >
      <ReviewsContent {...props} />
    </Suspense>
  );
}
