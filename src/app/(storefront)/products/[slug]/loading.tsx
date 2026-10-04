import { Skeleton } from '@/components/ui/skeleton';

export default function ProductLoading() {
  return (
    <div
      role="status"
      aria-label="Loading product"
      className="container-page grid gap-8 pt-8 pb-24 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14"
    >
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
