import { PageHeader } from '@/components/admin/page-header';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function CategoriesLoading() {
  return (
    <>
      <PageHeader title="Categories" />
      <SkeletonRegion label="Loading categories" className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </SkeletonRegion>
    </>
  );
}
