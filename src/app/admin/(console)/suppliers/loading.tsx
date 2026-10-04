import { PageHeader } from '@/components/admin/page-header';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function SuppliersLoading() {
  return (
    <>
      <PageHeader title="Suppliers" />
      <SkeletonRegion label="Loading suppliers" className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </SkeletonRegion>
    </>
  );
}
