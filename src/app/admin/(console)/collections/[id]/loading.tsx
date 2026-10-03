import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

/** Matches the edit screen: heading, then stacked form sections. */
export default function EditCollectionLoading() {
  return (
    <SkeletonRegion label="Loading collection">
      <div className="mb-8 flex flex-col gap-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="grid gap-6 border border-line bg-raised p-5 md:grid-cols-3 md:p-6"
          >
            <Skeleton className="h-6 w-32" />
            <div className="flex flex-col gap-4 md:col-span-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
