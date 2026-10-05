import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { formatPrice } from '@/components/ui/price';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import { requireStaffWith } from '@/lib/staff';
import { listOrdersForAdmin, type AdminOrderListParams } from '@/modules/orders/queries';
import type { OrderStatus } from '@/modules/orders/timeline';

export const metadata: Metadata = { title: 'Orders' };

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});
const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

const FILTERS = [
  { id: 'all', label: 'All orders' },
  { id: 'awaiting_verification', label: 'Awaiting verification' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

const hrefFor = (status: FilterId, q: string, page: number) => {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const text = params.toString();
  return `/admin/orders${text ? `?${text}` : ''}`;
};

export default async function OrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
  await requireStaffWith('orders.read');
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const status = (FILTERS.find((f) => f.id === one(raw.status))?.id ?? 'all') as FilterId;
  const q = (one(raw.q) ?? '').trim().slice(0, 80);
  const page = Math.max(1, Math.min(500, Number.parseInt(one(raw.page) ?? '1', 10) || 1));

  const params: AdminOrderListParams = {
    page,
    ...(status !== 'all' ? { status: status as OrderStatus | 'awaiting_verification' } : {}),
    ...(q ? { q } : {}),
  };
  const result = await listOrdersForAdmin(params);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const rule =
    'Every order is confirmed by a person; nothing is confirmed or cancelled automatically.';

  return (
    <>
      <PageHeader
        title="Orders"
        description={
          result.awaitingCount > 0
            ? `${result.awaitingCount} ${result.awaitingCount === 1 ? 'order is' : 'orders are'} waiting to be verified by your team. ${rule}`
            : rule
        }
      />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Button
              key={filter.id}
              asChild
              size="sm"
              variant={status === filter.id ? 'primary' : 'secondary'}
            >
              <Link
                href={hrefFor(filter.id, q, 1)}
                aria-current={status === filter.id ? 'page' : undefined}
              >
                {filter.label}
              </Link>
            </Button>
          ))}
        </nav>
        <form action="/admin/orders" method="get" role="search" className="flex gap-2">
          {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="orders-q" className="sr-only">
            Search orders
          </label>
          <Input
            id="orders-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Order number, name or phone"
            className="h-10 w-64"
            maxLength={80}
          />
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          title={q || status !== 'all' ? 'No orders match' : 'No orders yet'}
          description={
            q || status !== 'all'
              ? 'Try another filter or search.'
              : 'Orders placed on the storefront appear here, waiting for your team to verify them.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto border border-line bg-raised">
            <table className="w-full border-collapse type-admin">
              <caption className="sr-only">Orders</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    Order
                  </th>
                  <th scope="col" className={head}>
                    Customer
                  </th>
                  <th scope="col" className={head}>
                    Status
                  </th>
                  <th scope="col" className={cn(head, 'hidden text-right sm:table-cell')}>
                    Items
                  </th>
                  <th scope="col" className={cn(head, 'hidden lg:table-cell')}>
                    Payment
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className={cell}>
                      <Link
                        href={`/admin/orders/${row.id}`}
                        className="font-medium text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                      >
                        {row.orderNumber}
                      </Link>
                      <div className="type-small text-fg-muted">
                        {dateTime.format(new Date(row.placedAt))}
                      </div>
                    </td>
                    <td className={cell}>
                      <div>{row.customerName}</div>
                      <div className="type-small text-fg-muted">{row.phone}</div>
                    </td>
                    <td className={cell}>
                      <div className="flex flex-wrap items-center gap-2">
                        <OrderStatusBadge status={row.status} />
                        {row.riskFlags.length > 0 ? (
                          <Badge tone="outline">
                            {row.riskFlags.length} {row.riskFlags.length === 1 ? 'flag' : 'flags'}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className={cn(cell, 'hidden text-right tabular-nums sm:table-cell')}>
                      {row.itemCount}
                    </td>
                    <td className={cn(cell, 'hidden capitalize lg:table-cell')}>
                      {row.paymentStatus.replaceAll('_', ' ')}
                    </td>
                    <td className={cn(cell, 'text-right tabular-nums')}>
                      {formatPrice(deserialize(row.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            className="mt-6"
            page={page}
            totalPages={totalPages}
            hrefFor={(p) => hrefFor(status, q, p)}
          />
        </>
      )}
    </>
  );
}
