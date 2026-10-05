import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/components/ui/price';
import { deserialize } from '@/lib/money';
import type { CustomerOrderView } from '@/modules/orders/types';
import { OrderPlacedEvent } from './order-placed-event';
import { OrderTimeline } from './order-timeline';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'type-body text-fg' : 'type-small text-fg-muted'}>{label}</dt>
      <dd
        className={
          strong ? 'type-price text-h3 text-fg tabular-nums' : 'type-small text-fg tabular-nums'
        }
      >
        {value}
      </dd>
    </div>
  );
}

const PAYMENT_NOTE: Record<CustomerOrderView['payment']['status'], string> = {
  unpaid: 'Pay when your order arrives.',
  pending: 'Awaiting payment.',
  paid: 'Paid.',
  partially_refunded: 'Partly refunded.',
  refunded: 'Refunded.',
  failed: 'Payment did not go through.',
};

/**
 * The order page. Straight after placing it greets the customer by name and says plainly that a
 * person will confirm the order; later visits show the same page without the greeting.
 */
export function OrderConfirmation({
  order,
  justPlaced,
  extra,
}: {
  order: CustomerOrderView;
  justPlaced: boolean;
  /** Editorial rail shown at the end ("Style it with"). */
  extra?: React.ReactNode;
}) {
  const subtotal = deserialize(order.subtotal);
  const shipping = deserialize(order.shipping);
  const total = deserialize(order.total);
  const discount = deserialize(order.discount);

  return (
    <article className="container-page py-12 md:py-20">
      {justPlaced ? (
        <OrderPlacedEvent
          orderNumber={order.orderNumber}
          valueMinor={total.minor.toString()}
          currency={total.currency}
        />
      ) : null}

      <header className="mx-auto max-w-2xl text-center">
        <p className="type-eyebrow text-accent-text">Order {order.orderNumber}</p>
        <h1 className="mt-3 type-display-lg text-fg">
          {justPlaced ? `Thank you, ${order.firstName}` : `Your order, ${order.firstName}`}
        </h1>
        <p className="mt-5 type-body text-fg-muted">
          {order.status === 'placed' || order.status === 'under_verification'
            ? 'Our team will personally confirm your order shortly, usually within 2 hours. We will call the number you gave us.'
            : order.timeline.note}
        </p>
        {order.emailMasked ? (
          <p className="mt-2 type-small text-fg-muted">
            A copy of this order is on its way to {order.emailMasked}.
          </p>
        ) : null}
      </header>

      <div className="mx-auto mt-12 max-w-2xl md:mt-16">
        <OrderTimeline timeline={order.timeline} />
      </div>

      <div className="mt-16 grid gap-12 md:mt-20 lg:grid-cols-12 lg:gap-16">
        <section aria-labelledby="order-items" className="lg:col-span-7">
          <h2 id="order-items" className="type-h3 text-fg">
            Your pieces
          </h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {order.items.map((item, index) => (
              <li key={`${item.title}-${item.variantLabel}-${index}`} className="flex gap-4 py-5">
                <div
                  className="relative w-20 shrink-0 overflow-hidden bg-stone-200"
                  style={{ aspectRatio: '4 / 5' }}
                >
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="type-body text-fg">{item.title}</p>
                    <p className="type-small text-fg-muted">
                      {item.variantLabel} · Quantity {item.quantity}
                    </p>
                  </div>
                  <p className="type-small text-fg tabular-nums">
                    {formatPrice(deserialize(item.lineTotal))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-6 flex flex-col gap-2">
            <Row label="Subtotal" value={formatPrice(subtotal)} />
            {discount.minor > 0n ? (
              <Row label="Discount" value={`-${formatPrice(discount)}`} />
            ) : null}
            <Row
              label="Delivery"
              value={shipping.minor === 0n ? 'Complimentary' : formatPrice(shipping)}
            />
            <div className="mt-2 border-t border-line pt-4">
              <Row label="Total" value={formatPrice(total)} strong />
            </div>
          </dl>
        </section>

        <aside className="flex flex-col gap-10 lg:col-span-5">
          <section aria-labelledby="order-delivery">
            <h2 id="order-delivery" className="type-eyebrow text-fg">
              Delivery to
            </h2>
            <address className="mt-3 type-body text-fg not-italic">
              <span className="block">{order.address.name}</span>
              {order.address.lines.map((line) => (
                <span key={line} className="block text-fg-muted">
                  {line}
                </span>
              ))}
            </address>
            <p className="mt-3 type-small text-fg-muted">
              {order.delivery.rateName}, {order.delivery.zoneName}: {order.delivery.eta}
            </p>
          </section>

          <section aria-labelledby="order-payment">
            <h2 id="order-payment" className="type-eyebrow text-fg">
              Payment
            </h2>
            <p className="mt-3 type-body text-fg">{order.payment.label}</p>
            <p className="type-small text-fg-muted">{PAYMENT_NOTE[order.payment.status]}</p>
          </section>

          <section aria-labelledby="order-account" className="border border-line bg-raised p-6">
            <h2 id="order-account" className="type-h3 text-fg">
              Create an account to track your orders
            </h2>
            <p className="mt-2 type-small text-fg-muted">
              Accounts are opening soon. When they do, we will keep this order with your phone
              number so you can claim it. Until then, keep this page&rsquo;s link, or look your
              order up any time with your order number and phone number.
            </p>
            <div className="mt-4">
              <Button asChild variant="secondary" size="sm">
                <Link href="/track">Track an order</Link>
              </Button>
            </div>
          </section>
        </aside>
      </div>

      {extra ? <div className="mt-20 md:mt-28">{extra}</div> : null}
    </article>
  );
}
