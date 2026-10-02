import { Skeleton } from '@/components/ui/skeleton';

/** Shown while the signed-in staff member is being resolved: same frame as the real shell. */
export function AdminShellSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the console"
      className="min-h-dvh bg-page lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]"
    >
      <aside className="hidden h-dvh border-r border-line bg-raised p-5 lg:block">
        <Skeleton className="h-5 w-24" />
        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <div>
        <div className="flex h-14 items-center gap-3 border-b border-line px-4 md:px-6">
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>
        <div className="flex flex-col gap-4 px-4 py-6 md:px-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
      <span className="sr-only">Loading the console</span>
    </div>
  );
}
