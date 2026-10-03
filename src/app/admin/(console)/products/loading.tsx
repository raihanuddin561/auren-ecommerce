import { Skeleton } from '@/components/ui/skeleton';

/** Shape of the product list while it loads. */
export default function ProductsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading products" role="status">
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-80 max-w-full" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
      <div className="border border-line bg-raised">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-line p-3 last:border-b-0"
          >
            <Skeleton className="aspect-[4/5] w-10" />
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
