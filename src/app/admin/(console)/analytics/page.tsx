import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AnalyticsView } from '@/components/admin/analytics/analytics-view';
import { getAnalyticsOverviewQuery } from '@/modules/analytics/queries';
import { analyticsRangeSchema, type AnalyticsRange } from '@/modules/analytics/schemas';
import { requireStaff } from '@/lib/staff';

export const metadata: Metadata = {
  title: 'Business Analytics & Intelligence | AUREN Admin',
};

interface AnalyticsPageProps {
  searchParams: Promise<{
    range?: string;
  }>;
}

async function AnalyticsContent({ searchParams }: AnalyticsPageProps) {
  await requireStaff();
  const params = await searchParams;
  const parsedRange = analyticsRangeSchema.safeParse(params.range);
  const range: AnalyticsRange = parsedRange.success ? parsedRange.data : '30d';

  const data = await getAnalyticsOverviewQuery(range);

  return <AnalyticsView data={data} />;
}

export default function AnalyticsPage(props: AnalyticsPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center type-small text-fg-muted">
          Compiling commercial metrics, conversion funnels, and atelier intelligence...
        </div>
      }
    >
      <AnalyticsContent {...props} />
    </Suspense>
  );
}
