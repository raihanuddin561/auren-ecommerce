import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/components/ui/price';
import { deserialize } from '@/lib/money';
import type { CheckoutSummary } from '@/modules/checkout/types';

/** Items and the totals breakdown. Delivery shows "Choose your district" until an address is known. */
export function OrderSummaryBody({ summary }: { summary: CheckoutSummary }) {
  const { cart, totals, delivery } = summary;
  const shipping = totals.shipping ? deserialize(totals.shipping) : null;
  const total = totals.total ? deserialize(totals.total) : null;
  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-line">
        {cart.lines.map((line) => (
          <li key={line.variantId} className="flex gap-4 py-4 first:pt-0">
            <div
              className="relative w-16 shrink-0 overflow-hidden bg-stone-200"
              style={{ aspectRatio: '4 / 5' }}
            >
              {line.image ? (
                <Image src={line.image.url} alt="" fill sizes="64px" className="object-cover" />
              ) : null}
              <span
                aria-hidden="true"
                className="absolute top-0 right-0 bg-fg px-1.5 py-0.5 text-eyebrow leading-none text-page tabular-nums"
              >
                {line.quantity}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="type-small text-fg">{line.productTitle}</p>
                <p className="type-small text-fg-muted">
                  {line.optionsLabel}
                  <span className="sr-only">, quantity {line.quantity}</span>
                </p>
              </div>
              <p className="type-small text-fg tabular-nums">
                {formatPrice(deserialize(line.lineTotal))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-2 border-t border-line pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-small text-fg-muted">Subtotal</dt>
          <dd className="type-small text-fg tabular-nums">
            {formatPrice(deserialize(totals.subtotal))}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-small text-fg-muted">
            Delivery{delivery ? ` (${delivery.zoneName})` : ''}
          </dt>
          <dd className="type-small text-fg tabular-nums">
            {shipping === null
              ? 'Choose your district'
              : shipping.minor === 0n
                ? 'Complimentary'
                : formatPrice(shipping)}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <dt className="type-body text-fg">Total</dt>
          <dd className="type-price text-h3 text-fg tabular-nums" data-testid="order-total">
            {total ? formatPrice(total) : formatPrice(deserialize(totals.subtotal))}
          </dd>
        </div>
        <p className="type-small text-fg-muted">Prices include tax.</p>
      </dl>

      <Link
        href="/cart"
        className="type-small text-fg underline decoration-gold underline-offset-4 hover:decoration-2"
      >
        Edit your bag
      </Link>
    </div>
  );
}
