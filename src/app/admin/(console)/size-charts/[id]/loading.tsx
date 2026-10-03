import { PageHeader } from '@/components/admin/page-header';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function EditSizeChartLoading() {
  return (
    <>
      <PageHeader title="Size chart" />
      <SkeletonRegion label="Loading the size chart" className="flex flex-col gap-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </SkeletonRegion>
    </>
  );
}
