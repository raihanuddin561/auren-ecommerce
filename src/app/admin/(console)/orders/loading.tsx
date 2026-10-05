import { PageHeader } from '@/components/admin/page-header';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function OrdersLoading() {
  return (
    <>
      <PageHeader title="Orders" />
      <SkeletonRegion label="Loading orders" className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </SkeletonRegion>
    </>
  );
}
