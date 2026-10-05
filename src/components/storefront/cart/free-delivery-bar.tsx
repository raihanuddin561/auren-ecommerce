import { formatPrice } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize, divideRound } from '@/lib/money';
import type { CartView } from '@/modules/cart/view';

/** "You are ৳1,200 from complimentary delivery", with a hairline progress bar. */
export function FreeDeliveryBar({
  view,
  className,
}: {
  view: Pick<CartView, 'freeDelivery' | 'subtotal' | 'count'>;
  className?: string;
}) {
  const { threshold, remaining, reached } = view.freeDelivery;
  if (!threshold || view.count === 0) return null;
  const goal = deserialize(threshold);
  const subtotal = deserialize(view.subtotal);
  // Whole percent, computed in minor units (no floats near money).
  const percent = reached ? 100 : Number(divideRound(subtotal.minor * 100n, goal.minor, 'down'));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="type-small text-fg" aria-live="polite">
        {reached
          ? 'Complimentary delivery unlocked.'
          : `Add ${formatPrice(deserialize(remaining!))} more for complimentary delivery.`}
      </p>
      <div
        role="progressbar"
        aria-label="Progress toward complimentary delivery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-0.5 w-full bg-line"
      >
        <div
          className="h-full bg-gold transition-[width] duration-500 ease-auren motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
