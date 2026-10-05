import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { OrderVerificationPanel } from '@/components/admin/orders/order-verification-panel';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { getOrderForAdmin } from '@/modules/orders/queries';
import { STATUS_LABEL, type OrderStatus } from '@/modules/orders/timeline';

export const metadata: Metadata = { title: 'Order' };

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});
const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-top';

const EVENT_LABEL: Record<string, string> = {
  placed: 'Order placed by the customer',
  status_changed: 'Status changed',
  note: 'Note added',
  payment: 'Payment update',
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-raised p-5">
      <h2 className="mb-3 type-eyebrow text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}

export default async function OrderPage({ params }: PageProps<'/admin/orders/[id]'>) {
  const staff = await requireStaffWith('orders.read');
  const { id } = await params;
  const canVerify = hasPermission(staff, 'orders.verify');
  // Cost of goods and profit are shown only to staff who buy stock or read finance.
  const canSeeCost =
    hasPermission(staff, 'purchasing.manage') || hasPermission(staff, 'finance.read');
  const order = await getOrderForAdmin(id, { includeCost: canSeeCost });
  if (!order) notFound();

  const address = order.address;
  const money = (value: { minor: string; currency: string }) => formatPrice(deserialize(value));

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        breadcrumb={[{ label: 'Orders', href: '/admin/orders' }, { label: order.orderNumber }]}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <span>Placed {dateTime.format(new Date(order.placedAt))}</span>
            {order.riskFlags.map((flag) => (
              <Badge key={flag} tone="outline">
                {flag.replaceAll('_', ' ')}
              </Badge>
            ))}
          </span>
        }
      />

      {order.awaitingVerification ? (
        <OrderVerificationPanel
          orderId={order.id}
          orderNumber={order.orderNumber}
          customerName={order.customer.name}
          customerPhone={order.customer.phone}
          canVerify={canVerify}
          status={order.status}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section aria-labelledby="items-heading" className="border border-line bg-raised">
            <h2 id="items-heading" className="border-b border-line px-5 py-4 type-h3 text-fg">
              Items
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse type-admin">
                <caption className="sr-only">Items in this order</caption>
                <thead>
                  <tr>
                    <th scope="col" className={head}>
                      Item
                    </th>
                    <th scope="col" className={cn(head, 'text-right')}>
                      Qty
                    </th>
                    <th scope="col" className={cn(head, 'text-right')}>
                      Price
                    </th>
                    {canSeeCost ? (
                      <th scope="col" className={cn(head, 'text-right')}>
                        Cost
                      </th>
                    ) : null}
                    <th scope="col" className={cn(head, 'text-right')}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr
                      key={`${item.sku}-${index}`}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className={cell}>
                        <div className="flex gap-3">
                          <div
                            className="relative w-10 shrink-0 overflow-hidden bg-stone-200"
                            style={{ aspectRatio: '4 / 5' }}
                          >
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt=""
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <div className="text-fg">{item.title}</div>
                            <div className="type-small text-fg-muted">
                              {item.variantLabel} · {item.sku}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={cn(cell, 'text-right tabular-nums')}>{item.quantity}</td>
                      <td className={cn(cell, 'text-right tabular-nums')}>
                        {money(item.unitPrice)}
                      </td>
                      {canSeeCost ? (
                        <td className={cn(cell, 'text-right tabular-nums')}>
                          {item.unitCost ? money(item.unitCost) : ''}
                        </td>
                      ) : null}
                      <td className={cn(cell, 'text-right tabular-nums')}>
                        {money(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="flex flex-col gap-1.5 border-t border-line px-5 py-4 type-admin">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Subtotal</dt>
                <dd className="tabular-nums">{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Delivery ({order.delivery.zoneName})</dt>
                <dd className="tabular-nums">
                  {order.delivery.free ? 'Complimentary' : money(order.shipping)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2 type-body text-fg">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(order.total)}</dd>
              </div>
              {order.grossProfit ? (
                <div className="flex justify-between gap-4 pt-1 text-fg-muted">
                  <dt>Gross profit on goods (before delivery and fees)</dt>
                  <dd className="tabular-nums">{money(order.grossProfit)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section aria-labelledby="timeline-heading" className="border border-line bg-raised p-5">
            <h2 id="timeline-heading" className="mb-4 type-h3 text-fg">
              Timeline
            </h2>
            <ol className="flex flex-col gap-3">
              {order.events.map((event, index) => (
                <li
                  key={`${event.createdAt}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-4"
                >
                  <span className="type-admin text-fg">
                    {EVENT_LABEL[event.type] ?? event.type.replaceAll('_', ' ')}
                    {event.toStatus
                      ? `: ${STATUS_LABEL[event.toStatus as OrderStatus] ?? event.toStatus}`
                      : ''}
                  </span>
                  <time dateTime={event.createdAt} className="type-small text-fg-muted">
                    {dateTime.format(new Date(event.createdAt))}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <Block title="Customer">
            <p className="type-body text-fg">{order.customer.name}</p>
            <p className="type-admin text-fg-muted">
              <a
                href={`tel:${order.customer.phone}`}
                className="underline decoration-gold underline-offset-4"
              >
                {order.customer.phone}
              </a>
            </p>
            {order.customer.email ? (
              <p className="type-admin text-fg-muted">{order.customer.email}</p>
            ) : null}
            {order.customerNote ? (
              <p className="mt-3 border-t border-line pt-3 type-admin text-fg">
                <span className="type-small text-fg-muted">Note from the customer: </span>
                {order.customerNote}
              </p>
            ) : null}
          </Block>
          <Block title="Delivery address">
            <address className="type-admin text-fg not-italic">
              <span className="block">{address.fullName}</span>
              <span className="block">{address.line1}</span>
              {address.line2 ? <span className="block">{address.line2}</span> : null}
              <span className="block">
                {[address.area, address.thana.name].filter(Boolean).join(', ')}
              </span>
              <span className="block">
                {[address.district.name, address.division.name, address.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </address>
            <p className="mt-3 type-small text-fg-muted">
              {order.delivery.rateName}, {order.delivery.minDays} to {order.delivery.maxDays} days
            </p>
          </Block>
          <Block title="Payment">
            {order.payments.map((payment, index) => (
              <p key={`${payment.createdAt}-${index}`} className="type-admin text-fg">
                {payment.provider === 'cod' ? 'Cash on delivery' : payment.provider}:{' '}
                {money(payment.amount)} <span className="text-fg-muted">({payment.status})</span>
              </p>
            ))}
            <p className="mt-1 type-small text-fg-muted capitalize">
              Order payment status: {order.paymentStatus.replaceAll('_', ' ')}
            </p>
          </Block>
          <Block title="Risk">
            <p className="type-admin text-fg">Score {order.riskScore} of 100</p>
            <p className="type-small text-fg-muted">
              {order.riskFlags.length > 0
                ? order.riskFlags.map((flag) => flag.replaceAll('_', ' ')).join(', ')
                : 'No flags.'}
            </p>
          </Block>
        </div>
      </div>
    </>
  );
}
