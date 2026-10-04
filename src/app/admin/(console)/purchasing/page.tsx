import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { PO_STATUS_LABEL, PoStatusBadge } from '@/components/admin/purchasing/po-status-badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import { requireStaffWith } from '@/lib/staff';
import { listPurchaseOrdersForAdmin } from '@/modules/purchasing/queries';
import { poListSchema } from '@/modules/purchasing/schemas';

export const metadata: Metadata = { title: 'Purchase orders' };

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

const href = (status: string, page: number) => {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const text = params.toString();
  return `/admin/purchasing${text ? `?${text}` : ''}`;
};

export default async function PurchasingPage({ searchParams }: PageProps<'/admin/purchasing'>) {
  await requireStaffWith('purchasing.manage');
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const parsed = poListSchema.safeParse({
    ...(one(raw.status) ? { status: one(raw.status) } : {}),
    ...(one(raw.page) ? { page: one(raw.page) } : {}),
  });
  const params = parsed.success ? parsed.data : poListSchema.parse({});
  const result = await listPurchaseOrdersForAdmin(params);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Stock you have ordered from suppliers. Receiving a delivery adds it to inventory and updates what each unit cost you."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/suppliers">Suppliers</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/purchasing/new">New purchase order</Link>
            </Button>
          </>
        }
      />
      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        {['all', 'draft', 'ordered', 'partially_received', 'received', 'cancelled'].map(
          (status) => (
            <Button
              key={status}
              asChild
              size="sm"
              variant={params.status === status ? 'primary' : 'secondary'}
            >
              <Link
                href={href(status, 1)}
                aria-current={params.status === status ? 'page' : undefined}
              >
                {status === 'all' ? 'All orders' : PO_STATUS_LABEL[status]}
              </Link>
            </Button>
          ),
        )}
      </nav>
      {result.rows.length === 0 ? (
        <EmptyState
          title={params.status === 'all' ? 'No purchase orders yet' : 'No orders with this status'}
          description={
            params.status === 'all'
              ? 'Raise a purchase order to bring stock in. Products only become purchasable once stock is received.'
              : 'Try another status.'
          }
          action={
            params.status === 'all' ? (
              <Button asChild size="sm">
                <Link href="/admin/purchasing/new">New purchase order</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto border border-line bg-raised">
            <table className="w-full border-collapse type-admin">
              <caption className="sr-only">Purchase orders</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    Order
                  </th>
                  <th scope="col" className={head}>
                    Supplier
                  </th>
                  <th scope="col" className={head}>
                    Status
                  </th>
                  <th scope="col" className={cn(head, 'hidden text-right sm:table-cell')}>
                    Received
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    Total
                  </th>
                  <th scope="col" className={cn(head, 'hidden lg:table-cell')}>
                    Expected
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className={cell}>
                      <Link
                        href={`/admin/purchasing/${row.id}`}
                        className="font-medium text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                      >
                        {row.poNumber}
                      </Link>
                      <div className="type-small text-fg-muted">
                        {dateFormat.format(new Date(row.createdAt))}
                      </div>
                    </td>
                    <td className={cell}>{row.supplierName}</td>
                    <td className={cell}>
                      <PoStatusBadge status={row.status} />
                    </td>
                    <td className={cn(cell, 'hidden text-right tabular-nums sm:table-cell')}>
                      {row.received} / {row.units}
                    </td>
                    <td className={cn(cell, 'text-right tabular-nums')}>{row.total}</td>
                    <td className={cn(cell, 'hidden lg:table-cell')}>
                      {row.expectedAt ? dateFormat.format(new Date(row.expectedAt)) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            className="mt-6"
            page={params.page}
            totalPages={totalPages}
            hrefFor={(page) => href(params.status, page)}
          />
        </>
      )}
    </>
  );
}
