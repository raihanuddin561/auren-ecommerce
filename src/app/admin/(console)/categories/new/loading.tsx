import { PageHeader } from '@/components/admin/page-header';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function NewCategoryLoading() {
  return (
    <>
      <PageHeader title="New category" />
      <SkeletonRegion label="Loading the form" className="flex flex-col gap-6">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-48 w-full" />
      </SkeletonRegion>
    </>
  );
}
