import { Skeleton } from '@/components/ui/skeleton';

/** Shape of the product screen while it loads: header, then the stacked sections. */
export default function EditProductLoading() {
  return (
    <div aria-busy="true" aria-label="Loading product" role="status">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="mb-8 h-4 w-40" />
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="grid gap-6 border border-line bg-raised p-6 md:grid-cols-3">
            <Skeleton className="h-6 w-32" />
            <div className="flex flex-col gap-4 md:col-span-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
