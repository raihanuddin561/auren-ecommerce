import { Tag } from 'lucide-react';
import { formatPrice } from '@/components/ui/price';
import { deserialize } from '@/lib/money';
import type { CartView } from '@/modules/cart/view';

/** Subtotal and what is still to be decided, in the words the brand uses. */
export function CartTotals({
  view,
}: {
  view: Pick<CartView, 'subtotal' | 'discount' | 'subtotalAfterDiscount'>;
}) {
  const originalSubtotal = deserialize(view.subtotal);
  const discountAmount = view.discount ? deserialize(view.discount.amount) : null;
  const hasDiscount = Boolean(discountAmount && discountAmount.minor > 0n && view.discount);
  const finalSubtotal =
    hasDiscount && view.subtotalAfterDiscount
      ? deserialize(view.subtotalAfterDiscount)
      : originalSubtotal;

  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <dt className={hasDiscount ? 'type-body text-fg-muted' : 'type-body text-fg'}>
            Subtotal
          </dt>
          <dd
            className={`tabular-nums ${
              hasDiscount ? 'type-body text-fg-muted line-through' : 'type-price text-fg'
            }`}
          >
            {formatPrice(originalSubtotal)}
          </dd>
        </div>

        {hasDiscount && view.discount && discountAmount ? (
          <div className="flex items-baseline justify-between gap-4 text-gold-strong dark:text-gold">
            <dt className="flex items-center gap-1.5 type-small font-medium">
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span>Discount ({view.discount.code})</span>
            </dt>
            <dd className="type-small font-medium tabular-nums">-{formatPrice(discountAmount)}</dd>
          </div>
        ) : null}

        {hasDiscount ? (
          <div className="flex items-baseline justify-between gap-4 border-t border-line/60 pt-2">
            <dt className="type-body font-medium text-fg">Updated Subtotal</dt>
            <dd className="type-price font-semibold text-fg tabular-nums">
              {formatPrice(finalSubtotal)}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="type-small text-fg-muted">
        Delivery is calculated at checkout from your address. Prices include tax.
      </p>
    </div>
  );
}

export const TRUST_LINES = [
  'Cash on delivery across Bangladesh',
  'Our team confirms every order personally',
  'Easy size exchange',
] as const;
