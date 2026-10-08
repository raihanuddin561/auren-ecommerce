import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Tells staff that variants cannot be ordered because they have no cost basis, and links to the
 * filtered list where "Set cost" lives. Text carries the meaning; the border colour only supports it.
 */
export function NoCostBanner({ count, href }: { count: number; href: string }) {
  if (count <= 0) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border border-warning bg-raised px-4 py-3"
    >
      <p className="type-admin text-fg">
        <strong className="tabular-nums">{count}</strong>{' '}
        {count === 1 ? 'variant cannot' : 'variants cannot'} be sold: no cost.{' '}
        <span className="text-fg-muted">
          Customers cannot order them until a cost is set, so profit can always be recorded.
        </span>
      </p>
      <Button asChild variant="secondary" size="sm" className="min-h-11">
        <Link href={href}>Show variants without cost</Link>
      </Button>
    </div>
  );
}
