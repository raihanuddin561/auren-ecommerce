import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './skeleton';

interface RatingProps {
  /** 0 to 5, halves and decimals allowed. */
  value: number;
  /** Number of reviews; shown in brackets when given. */
  count?: number;
  size?: number;
  className?: string;
}

/** Clamp to the 0-5 range and tolerate NaN. */
export function normalizeRating(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}

export function ratingLabel(value: number, count?: number): string {
  const rounded = Math.round(normalizeRating(value) * 10) / 10;
  const base = `Rated ${rounded} out of 5`;
  if (count === undefined) return base;
  return `${base} from ${count} ${count === 1 ? 'review' : 'reviews'}`;
}

/** Read-only star rating. Partial stars are clipped, never rounded, so 4.3 looks like 4.3. */
export function Rating({ value, count, size = 14, className }: RatingProps) {
  const safe = normalizeRating(value);
  return (
    <span className={cn('inline-flex items-center gap-2 type-small text-fg', className)}>
      <span role="img" aria-label={ratingLabel(safe, count)} className="inline-flex gap-0.5">
        {Array.from({ length: 5 }, (_, index) => {
          const fill = Math.min(1, Math.max(0, safe - index));
          return (
            <span
              key={index}
              className="relative inline-flex"
              style={{ width: size, height: size }}
            >
              <Star
                aria-hidden="true"
                width={size}
                height={size}
                strokeWidth={1.25}
                className="absolute inset-0 text-stone-500"
              />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  aria-hidden="true"
                  width={size}
                  height={size}
                  strokeWidth={1.25}
                  className="fill-gold text-gold"
                />
              </span>
            </span>
          );
        })}
      </span>
      {count === undefined ? null : (
        <span aria-hidden="true" className="text-fg-muted tabular-nums">
          ({count})
        </span>
      )}
    </span>
  );
}

export function RatingSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-4 w-28', className)} />;
}
