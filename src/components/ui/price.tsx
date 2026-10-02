import { cva, type VariantProps } from 'class-variance-authority';
import { compare, format as formatMoney, type Money } from '@/lib/money';
import { cn } from '@/lib/cn';
import { Skeleton } from './skeleton';

/** Display text for a price. The taka sign replaces the ISO code for BDT, as in all AUREN copy. */
export function formatPrice(value: Money): string {
  return formatMoney(value, { trimZeroFraction: true }).replace(/^BDT\s?/, '৳');
}

const priceVariants = cva('inline-flex flex-wrap items-baseline gap-x-2 type-price', {
  variants: {
    size: {
      sm: 'text-small',
      md: 'text-body',
      lg: 'text-h3',
    },
  },
  defaultVariants: { size: 'md' },
});

interface PriceProps extends VariantProps<typeof priceVariants> {
  price: Money;
  /** Original price when reduced. Shown struck through in stone. */
  compareAt?: Money | null;
  className?: string;
}

/**
 * Formats through lib/money only. A compare-at price is shown only when it really is higher than
 * the current price in the same currency.
 */
export function Price({ price, compareAt, size, className }: PriceProps) {
  const reduced = Boolean(
    compareAt && compareAt.currency === price.currency && compare(compareAt, price) > 0,
  );

  return (
    <span className={cn(priceVariants({ size }), className)}>
      {reduced ? <span className="sr-only">Now </span> : null}
      <span className={cn(reduced && 'text-fg')}>{formatPrice(price)}</span>
      {reduced ? (
        <>
          <span className="sr-only">, was </span>
          <s className="text-fg-muted decoration-fg-muted/60">
            {compareAt ? formatPrice(compareAt) : null}
          </s>
        </>
      ) : null}
    </span>
  );
}

export function PriceSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-5 w-20', className)} />;
}
