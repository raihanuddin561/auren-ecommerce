import type { Metadata } from 'next';
import Link from 'next/link';
import { ExportButton, SavedViews } from '@/components/admin/orders/list-tools';
import { OrdersTable } from '@/components/admin/orders/orders-table';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { NativeSelect } from '@/components/storefront/checkout/native-select';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import {
  ORDER_CHANNEL_FILTERS,
  ORDER_PAYMENT_FILTERS,
  listOrdersForAdmin,
  savedOrderViews,
  type AdminOrderListParams,
} from '@/modules/orders/queries';
import { CHANNEL_LABEL } from '@/modules/orders/schemas';
import { listCourierOptions } from '@/modules/shipping/queries';

export const metadata: Metadata = { title: 'Orders' };

const FILTERS = [
  { id: 'all', label: 'All orders' },
  { id: 'awaiting_verification', label: 'Awaiting verification' },
  { id: 'ready_to_ship', label: 'Ready to ship' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'delivery_failed', label: 'Delivery failed' },
  { id: 'return_requested', label: 'Returns' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const day = /^\d{4}-\d{2}-\d{2}$/;

export default async function OrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
  const staff = await requireStaffWith('orders.read');
  const canEnter = hasPermission(staff, 'orders.update');
  const raw = await searchParams;
  const status = (FILTERS.find((f) => f.id === one(raw.status))?.id ?? 'all') as FilterId;
  const q = (one(raw.q) ?? '').trim().slice(0, 80);
  const page = Math.max(1, Math.min(500, Number.parseInt(one(raw.page) ?? '1', 10) || 1));
  const payment = ORDER_PAYMENT_FILTERS.find((value) => value === one(raw.payment));
  const channel = ORDER_CHANNEL_FILTERS.find((value) => value === one(raw.channel));
  const assigneeRaw = one(raw.assignee);
  const assignee =
    assigneeRaw === 'mine' ? staff.id : assigneeRaw === 'unassigned' ? 'unassigned' : undefined;
  const from = day.test(one(raw.from) ?? '') ? one(raw.from) : undefined;
  const to = day.test(one(raw.to) ?? '') ? one(raw.to) : undefined;

  // The filters in the address, without the page: what a saved view or an export keeps.
  const filterQuery: Record<string, string> = {};
  if (status !== 'all') filterQuery.status = status;
  if (q) filterQuery.q = q;
  if (payment) filterQuery.payment = payment;
  if (channel) filterQuery.channel = channel;
  if (assigneeRaw === 'mine' || assigneeRaw === 'unassigned') filterQuery.assignee = assigneeRaw;
  if (from) filterQuery.from = from;
  if (to) filterQuery.to = to;
  const currentQuery = new URLSearchParams(filterQuery).toString();
  const hrefFor = (nextStatus: FilterId, nextPage: number) => {
    const params = new URLSearchParams(filterQuery);
    if (nextStatus === 'all') params.delete('status');
    else params.set('status', nextStatus);
    if (nextPage > 1) params.set('page', String(nextPage));
    const text = params.toString();
    return `/admin/orders${text ? `?${text}` : ''}`;
  };

  const params: AdminOrderListParams = {
    page,
    ...(status !== 'all' ? { status: status as NonNullable<AdminOrderListParams['status']> } : {}),
    ...(q ? { q } : {}),
    ...(payment ? { payment } : {}),
    ...(channel ? { channel } : {}),
    ...(assignee ? { assignee } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const [result, views] = await Promise.all([
    listOrdersForAdmin(params),
    savedOrderViews(staff.userId),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filtered = currentQuery !== '';
  const rule =
    'Every order is confirmed by a person; nothing is confirmed or cancelled automatically.';
  const apiCouriers = listCourierOptions()
    .filter((courier) => courier.mode === 'api' && courier.configured)
    .map((courier) => ({ id: courier.id as 'pathao' | 'steadfast', label: courier.label }));

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <>
            <ExportButton query={filterQuery} />
            {canEnter ? (
              <Button asChild size="sm">
                <Link href="/admin/orders/new">Enter an order</Link>
              </Button>
            ) : null}
          </>
        }
        description={
          result.awaitingCount > 0
            ? `${result.awaitingCount} ${result.awaitingCount === 1 ? 'order is' : 'orders are'} waiting to be verified by your team. ${rule}`
            : rule
        }
      />
      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter.id}
            asChild
            size="sm"
            variant={status === filter.id ? 'primary' : 'secondary'}
          >
            <Link
              href={hrefFor(filter.id, 1)}
              aria-current={status === filter.id ? 'page' : undefined}
            >
              {filter.label}
            </Link>
          </Button>
        ))}
      </nav>

      <form
        action="/admin/orders"
        method="get"
        role="search"
        className="mb-4 flex flex-wrap items-end gap-3 border border-line bg-raised p-4"
      >
        {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
        <label className="flex flex-col gap-1 type-small text-fg-muted">
          Search
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Order number, name or phone"
            className="h-10 w-56"
            maxLength={80}
          />
        </label>
        <label className="flex flex-col gap-1 type-small text-fg-muted">
          Payment
          <NativeSelect name="payment" defaultValue={payment ?? ''} className="h-10 w-44">
            <option value="">Any payment</option>
            {ORDER_PAYMENT_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 type-small text-fg-muted">
          Channel
          <NativeSelect name="channel" defaultValue={channel ?? ''} className="h-10 w-40">
            <option value="">Any channel</option>
            {ORDER_CHANNEL_FILTERS.map((value) => (
              <option key={value} value={value}>
                {CHANNEL_LABEL[value]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 type-small text-fg-muted">
          Verifier
          <NativeSelect name="assignee" defaultValue={assigneeRaw ?? ''} className="h-10 w-40">
            <option value="">Anyone</option>
            <option value="mine">Mine</option>
            <option value="unassigned">Unassigned</option>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 type-small text-fg-muted">
          Placed from
          <Input name="from" type="date" defaultValue={from ?? ''} className="h-10 w-40" />
        </label>
        <label className="flex flex-col gap-1 type-small text-fg-muted">
          to
          <Input name="to" type="date" defaultValue={to ?? ''} className="h-10 w-40" />
        </label>
        <Button type="submit" size="sm" variant="secondary">
          Apply
        </Button>
        {filtered ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/orders">Clear</Link>
          </Button>
        ) : null}
      </form>
      <div className="mb-6">
        <SavedViews views={views} currentQuery={currentQuery} />
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          title={filtered ? 'No orders match' : 'No orders yet'}
          description={
            filtered
              ? 'Try another filter or search.'
              : 'Orders placed on the storefront appear here, waiting for your team to verify them.'
          }
        />
      ) : (
        <>
          <OrdersTable
            rows={result.rows}
            canFulfil={hasPermission(staff, 'orders.fulfill')}
            canShip={hasPermission(staff, 'shipping.manage')}
            apiCouriers={apiCouriers}
          />
          <Pagination
            className="mt-6"
            page={page}
            totalPages={totalPages}
            hrefFor={(p) => hrefFor(status, p)}
          />
        </>
      )}
    </>
  );
}
