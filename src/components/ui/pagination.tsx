import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Icon } from './icon';

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Builds the crawlable URL for a page, for example `(p) => `/shop?page=${p}``. */
  hrefFor: (page: number) => string;
  className?: string;
}

/** Page numbers to show: first, last, and a window around the current page, with gaps as null. */
export function pageWindow(page: number, totalPages: number, radius = 1): Array<number | null> {
  const pages = new Set<number>([1, totalPages]);
  for (let p = page - radius; p <= page + radius; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | null> = [];
  sorted.forEach((p, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && p - previous > 1) result.push(null);
    result.push(p);
  });
  return result;
}

const item =
  'inline-flex size-11 items-center justify-center rounded-sm type-small tabular-nums transition-auren-fast';

/** Real links, so every page is crawlable and works without JavaScript. */
export function Pagination({ page, totalPages, hrefFor, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="Pagination" className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {hasPrevious ? (
            <Link
              href={hrefFor(page - 1)}
              rel="prev"
              aria-label="Previous page"
              className={cn(item, 'hover:bg-fg/8')}
            >
              <Icon icon={ChevronLeft} />
            </Link>
          ) : (
            <span aria-hidden="true" className={cn(item, 'text-fg-muted opacity-40')}>
              <Icon icon={ChevronLeft} />
            </span>
          )}
        </li>
        {pageWindow(page, totalPages).map((entry, index) => (
          <li key={entry ?? `gap-${index}`}>
            {entry === null ? (
              <span aria-hidden="true" className={cn(item, 'text-fg-muted')}>
                …
              </span>
            ) : (
              <Link
                href={hrefFor(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  item,
                  entry === page
                    ? 'border-b border-gold text-fg'
                    : 'text-fg-muted hover:bg-fg/8 hover:text-fg',
                )}
              >
                {entry}
              </Link>
            )}
          </li>
        ))}
        <li>
          {hasNext ? (
            <Link
              href={hrefFor(page + 1)}
              rel="next"
              aria-label="Next page"
              className={cn(item, 'hover:bg-fg/8')}
            >
              <Icon icon={ChevronRight} />
            </Link>
          ) : (
            <span aria-hidden="true" className={cn(item, 'text-fg-muted opacity-40')}>
              <Icon icon={ChevronRight} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
