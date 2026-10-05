import { formatPrice } from '@/components/ui/price';
import { deserialize } from '@/lib/money';
import type { CartView } from '@/modules/cart/view';

/** Subtotal and what is still to be decided, in the words the brand uses. */
export function CartTotals({ view }: { view: Pick<CartView, 'subtotal'> }) {
  return (
    <div className="flex flex-col gap-2">
      <dl className="flex items-baseline justify-between gap-4">
        <dt className="type-body text-fg">Subtotal</dt>
        <dd className="type-price text-fg tabular-nums">
          {formatPrice(deserialize(view.subtotal))}
        </dd>
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
