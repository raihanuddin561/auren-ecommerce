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
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xs border border-line/60 bg-raised/50 p-3',
        className,
      )}
    >
      <p className="flex items-center justify-between type-small text-fg" aria-live="polite">
        <span>
          {reached ? (
            <span className="font-medium text-gold">✦ Complimentary delivery unlocked</span>
          ) : (
            `Add ${formatPrice(deserialize(remaining!))} more for complimentary delivery`
          )}
        </span>
        <span className="type-caption font-mono text-fg-muted">{percent}%</span>
      </p>
      <div
        role="progressbar"
        aria-label="Progress toward complimentary delivery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-full overflow-hidden rounded-full bg-line/60"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-strong via-gold to-gold-soft transition-[width] duration-700 ease-auren motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
