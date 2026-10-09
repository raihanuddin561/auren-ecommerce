import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddNoteForm } from '@/components/admin/orders/add-note-form';
import { FulfilmentPanel } from '@/components/admin/orders/fulfilment-panel';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { ProfitPanel } from '@/components/admin/orders/profit-panel';
import { RefundPanel } from '@/components/admin/orders/refund-panel';
import { ReturnsPanel } from '@/components/admin/orders/returns-panel';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import { canSeeCostOfGoods, hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { getOrderForAdmin } from '@/modules/orders/queries';
import { CHANNEL_LABEL } from '@/modules/orders/schemas';
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
  placed: 'Order placed',
  status_changed: 'Status changed',
  note: 'Note',
  claimed: 'Claimed for verification',
  released: 'Released back to the queue',
  assigned: 'Assigned',
  attempt: 'Contact attempt logged',
  order_edited: 'Order edited while verifying',
  picking_started: 'Picking started',
  shipped: 'Handed to the courier',
  delivered: 'Delivered, cash collected',
  delivery_failed: 'Delivery failed',
  returned_to_origin: 'Parcel back with us',
  completed: 'Completed',
  parcel_update: 'Parcel update',
  refund: 'Refund recorded',
  return_requested: 'Return requested',
  return_approved: 'Return approved',
  return_received: 'Return received',
  returned: 'Return inspected',
  return_closed: 'Return closed',
  return_settled: 'Return settled',
  replacement_shipped: 'Replacement sent',
  refunded: 'Refunded',
  exchanged: 'Exchanged',
};

const OUTCOME_LABEL: Record<string, string> = {
  verified: 'Verified and confirmed',
  no_answer: 'No answer',
  busy: 'Line busy',
  wrong_number: 'Wrong number',
  callback_requested: 'Asked us to call back',
  customer_cancelled: 'Cancelled',
  suspected_fake: 'Suspected fake',
  order_edited: 'Order edited',
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
  const canSeeCost = canSeeCostOfGoods(staff);
  const order = await getOrderForAdmin(id, {
    includeCost: canSeeCost,
    includeShippingCharges: hasPermission(staff, 'shipping.manage'),
  });
  if (!order) notFound();

  const address = order.address;
  const money = (value: { minor: string; currency: string }) => formatPrice(deserialize(value));
  const confirmedOnward = ![
    'placed',
    'under_verification',
    'on_hold',
    'cancelled',
    'pending_payment',
    'payment_expired',
  ].includes(order.status);

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        breadcrumb={[{ label: 'Orders', href: '/admin/orders' }, { label: order.orderNumber }]}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <Badge tone="outline">{CHANNEL_LABEL[order.channel] ?? order.channel}</Badge>
            <span>Placed {dateTime.format(new Date(order.placedAt))}</span>
            {order.riskFlags.map((flag) => (
              <Badge key={flag} tone="outline">
                {flag.replaceAll('_', ' ')}
              </Badge>
            ))}
          </span>
        }
        actions={
          <>
            {confirmedOnward ? (
              <>
                <Button asChild size="sm" variant="secondary">
                  <a
                    href={`/admin/orders/${order.id}/document?kind=invoice`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Invoice (PDF)
                  </a>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <a
                    href={`/admin/orders/${order.id}/document?kind=packing_slip`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Packing slip (PDF)
                  </a>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {order.awaitingVerification ? (
        <section
          aria-label="Waiting for verification"
          className="mb-8 flex flex-wrap items-center justify-between gap-4 border-2 border-gold/60 bg-raised p-5"
        >
          <p className="type-admin text-fg">
            This order is waiting for a team member to speak to the customer and confirm it. Nothing
            can be prepared before then.
          </p>
          {hasPermission(staff, 'orders.verify') ? (
            <Button asChild>
              <Link href={`/admin/orders/verification?order=${order.id}`}>Verify this order</Link>
            </Button>
          ) : null}
        </section>
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
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-line last:border-b-0">
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
                            <div className="text-fg">
                              {item.title}
                              {item.isReplacement ? (
                                <Badge tone="gold" className="ml-2">
                                  Replacement
                                </Badge>
                              ) : null}
                            </div>
                            <div className="type-small text-fg-muted">
                              {item.variantLabel} · {item.sku}
                              {item.quantityReturned > 0
                                ? ` · ${item.quantityReturned} returned`
                                : ''}
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
            </dl>
          </section>

          <FulfilmentPanel
            order={order}
            canFulfil={hasPermission(staff, 'orders.fulfill')}
            canShip={hasPermission(staff, 'shipping.manage')}
            canSeeCost={canSeeCost || hasPermission(staff, 'shipping.manage')}
          />

          <ReturnsPanel
            order={order}
            canManage={hasPermission(staff, 'returns.manage')}
            canRefund={hasPermission(staff, 'orders.refund')}
            canShip={hasPermission(staff, 'shipping.manage')}
          />

          {order.profit ? (
            <ProfitPanel
              orderId={order.id}
              profit={order.profit}
              canAddCost={hasPermission(staff, 'finance.write')}
            />
          ) : null}

          <section aria-labelledby="timeline-heading" className="border border-line bg-raised p-5">
            <h2 id="timeline-heading" className="mb-4 type-h3 text-fg">
              Timeline
            </h2>
            <ol className="flex flex-col gap-3">
              {order.events.map((event, index) => (
                <li key={`${event.createdAt}-${index}`} className="flex flex-col">
                  <span className="flex flex-wrap items-baseline gap-x-4">
                    <span className="type-admin text-fg">
                      {EVENT_LABEL[event.type] ?? event.type.replaceAll('_', ' ')}
                      {event.toStatus && event.type === 'status_changed'
                        ? `: ${STATUS_LABEL[event.toStatus as OrderStatus] ?? event.toStatus}`
                        : ''}
                    </span>
                    <time dateTime={event.createdAt} className="type-small text-fg-muted">
                      {dateTime.format(new Date(event.createdAt))}
                      {event.staffName ? ` · ${event.staffName}` : ''}
                    </time>
                  </span>
                  {event.note ? (
                    <span className="type-small text-fg-muted">{event.note}</span>
                  ) : null}
                </li>
              ))}
            </ol>
            {hasPermission(staff, 'orders.update') ? <AddNoteForm orderId={order.id} /> : null}
          </section>

          {order.attempts.length > 0 ? (
            <section
              aria-labelledby="attempts-heading"
              className="border border-line bg-raised p-5"
            >
              <h2 id="attempts-heading" className="mb-4 type-h3 text-fg">
                Verification history
              </h2>
              <ol className="flex flex-col gap-2">
                {order.attempts.map((attempt, index) => (
                  <li key={`${attempt.at}-${index}`} className="type-admin">
                    <span className="text-fg">
                      {OUTCOME_LABEL[attempt.outcome] ?? attempt.outcome}
                    </span>
                    <span className="text-fg-muted">
                      {' '}
                      · {attempt.staffName} · {attempt.channel} ·{' '}
                      {dateTime.format(new Date(attempt.at))}
                    </span>
                    {attempt.note ? (
                      <p className="type-small text-fg-muted">{attempt.note}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
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
          <RefundPanel order={order} canRefund={hasPermission(staff, 'orders.refund')} />
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
