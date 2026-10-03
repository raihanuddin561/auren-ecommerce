import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

/** Matches the list: heading, action, then table rows. */
export default function CollectionsLoading() {
  return (
    <SkeletonRegion label="Loading collections">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-12 w-40" />
      </div>
      <div className="border border-line bg-raised">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex gap-6 border-b border-line px-4 py-3.5 last:border-b-0">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="hidden h-4 w-40 md:block" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
