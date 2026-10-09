import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPrice } from '@/components/ui/price';
import { deserialize } from '@/lib/money';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { getFulfilmentBoard } from '@/modules/orders/queries';

export const metadata: Metadata = { title: 'Shipping' };

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});
const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

const PARCEL_LABEL: Record<string, string> = {
  booked: 'Booked',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  failed: 'Delivery failed',
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="mb-8">
      <h2 className="mb-3 type-h3 text-fg">
        {title} <span className="type-admin text-fg-muted">({count})</span>
      </h2>
      {children}
    </section>
  );
}

export default async function ShippingPage() {
  const staff = await requireStaffWith('shipping.manage');
  const board = await getFulfilmentBoard();
  const canFulfil = hasPermission(staff, 'orders.fulfill');
  const readyIds = board.ready.map((order) => order.id).join(',');

  return (
    <>
      <PageHeader
        title="Shipping"
        description="Confirmed orders waiting for a parcel, parcels on their way, and deliveries that need a decision. Only orders a team member has confirmed appear here."
        actions={
          <>
            {canFulfil && board.ready.length > 0 ? (
              <Button asChild size="sm" variant="secondary">
                <a
                  href={`/admin/orders/print?kind=packing_slip&ids=${readyIds}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Print all packing slips
                </a>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/settings/orders">Packaging and rules</Link>
            </Button>
          </>
        }
      />

      <Section title="Ready to ship" count={board.ready.length}>
        {board.ready.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="Confirmed orders appear here until a parcel is booked."
          />
        ) : (
          <div className="overflow-x-auto border border-line bg-raised">
            <table className="w-full border-collapse type-admin">
              <caption className="sr-only">Orders ready to ship</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    Order
                  </th>
                  <th scope="col" className={head}>
                    Customer
                  </th>
                  <th scope="col" className={head}>
                    Area
                  </th>
                  <th scope="col" className={head}>
                    Status
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    To collect
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.ready.map((order) => (
                  <tr key={order.id} className="border-b border-line last:border-b-0">
                    <td className={cell}>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium underline decoration-gold underline-offset-4"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className={cell}>
                      {order.customerName}
                      <div className="type-small text-fg-muted">{order.phone}</div>
                    </td>
                    <td className={cell}>{order.area}</td>
                    <td className={cell}>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {formatPrice(deserialize(order.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="On the way" count={board.parcels.length}>
        {board.parcels.length === 0 ? (
          <p className="type-admin text-fg-muted">No parcels are with a courier.</p>
        ) : (
          <div className="overflow-x-auto border border-line bg-raised">
            <table className="w-full border-collapse type-admin">
              <caption className="sr-only">Parcels on their way</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    Order
                  </th>
                  <th scope="col" className={head}>
                    Courier
                  </th>
                  <th scope="col" className={head}>
                    Tracking
                  </th>
                  <th scope="col" className={head}>
                    Booked
                  </th>
                  <th scope="col" className={head}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.parcels.map((parcel) => (
                  <tr key={parcel.shipmentId} className="border-b border-line last:border-b-0">
                    <td className={cell}>
                      <Link
                        href={`/admin/orders/${parcel.orderId}`}
                        className="font-medium underline decoration-gold underline-offset-4"
                      >
                        {parcel.orderNumber}
                      </Link>
                      <div className="type-small text-fg-muted">{parcel.customerName}</div>
                    </td>
                    <td className={cell}>{parcel.courier}</td>
                    <td className={`${cell} font-mono`}>{parcel.trackingNumber}</td>
                    <td className={cell}>
                      {parcel.bookedAt ? dateTime.format(new Date(parcel.bookedAt)) : ''}
                    </td>
                    <td className={cell}>
                      <Badge tone="outline">{PARCEL_LABEL[parcel.status] ?? parcel.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Delivery failed" count={board.failed.length}>
        {board.failed.length === 0 ? (
          <p className="type-admin text-fg-muted">No failed deliveries.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {board.failed.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-line bg-raised px-4 py-3 type-admin"
              >
                <span>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-medium underline decoration-gold underline-offset-4"
                  >
                    {order.orderNumber}
                  </Link>{' '}
                  <span className="text-fg-muted">
                    {order.customerName}, {order.phone}
                  </span>
                </span>
                <span className="type-small text-fg-muted">
                  Book again, or record the parcel as back with us.
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
