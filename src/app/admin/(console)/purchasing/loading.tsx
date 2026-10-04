import { PageHeader } from '@/components/admin/page-header';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function PurchasingLoading() {
  return (
    <>
      <PageHeader title="Purchase orders" />
      <SkeletonRegion label="Loading purchase orders" className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </SkeletonRegion>
    </>
  );
}
