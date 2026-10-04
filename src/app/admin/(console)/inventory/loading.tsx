import { PageHeader } from '@/components/admin/page-header';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function InventoryLoading() {
  return (
    <>
      <PageHeader title="Inventory" />
      <SkeletonRegion label="Loading stock levels" className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </SkeletonRegion>
    </>
  );
}
