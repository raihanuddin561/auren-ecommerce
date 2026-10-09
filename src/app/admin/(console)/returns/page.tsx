import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { requireStaffWith } from '@/lib/staff';
import { RETURN_STATUS_LABEL } from '@/modules/returns/schemas';
import { listReturnsForAdmin } from '@/modules/returns/queries';

export const metadata: Metadata = { title: 'Returns' };

const PAGE_SIZE = 25;
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' });
const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

const FILTERS = [
  {
    id: 'open',
    label: 'Open',
    statuses: ['requested', 'approved', 'in_transit', 'received', 'inspected'],
  },
  { id: 'settled', label: 'Settled', statuses: ['refunded', 'exchanged', 'closed', 'rejected'] },
  { id: 'all', label: 'All', statuses: undefined },
] as const;

export default async function ReturnsPage({ searchParams }: PageProps<'/admin/returns'>) {
  await requireStaffWith('returns.manage');
  const raw = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const filter = FILTERS.find((item) => item.id === pick(raw.filter)) ?? FILTERS[0];
  const page = Math.max(1, Math.min(500, Number.parseInt(pick(raw.page) ?? '1', 10) || 1));
  const { rows, total } = await listReturnsForAdmin({
    ...(filter.statuses ? { statuses: filter.statuses } : {}),
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Returns"
        description="Customers ask from their order page within the return window. Open the order to approve, receive, inspect and settle."
      />
      <nav aria-label="Filter returns" className="mb-6 flex gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item.id}
            asChild
            size="sm"
            variant={item.id === filter.id ? 'primary' : 'secondary'}
          >
            <Link
              href={`/admin/returns${item.id === 'open' ? '' : `?filter=${item.id}`}`}
              aria-current={item.id === filter.id ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState
          title="No returns here"
          description="When a customer asks for a return or an exchange it appears in this list."
        />
      ) : (
        <>
          <div className="overflow-x-auto border border-line bg-raised">
            <table className="w-full border-collapse type-admin">
              <caption className="sr-only">Returns</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    Return
                  </th>
                  <th scope="col" className={head}>
                    Order
                  </th>
                  <th scope="col" className={head}>
                    Customer
                  </th>
                  <th scope="col" className={head}>
                    Type
                  </th>
                  <th scope="col" className={head}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className={cell}>
                      <span className="font-medium">{row.returnNumber}</span>
                      <div className="type-small text-fg-muted">
                        {dateTime.format(row.createdAt)}
                      </div>
                    </td>
                    <td className={cell}>
                      <Link
                        href={`/admin/orders/${row.order.id}`}
                        className="underline decoration-gold underline-offset-4"
                      >
                        {row.order.orderNumber}
                      </Link>
                    </td>
                    <td className={cell}>{row.order.customerName}</td>
                    <td className={`${cell} capitalize`}>{row.type}</td>
                    <td className={cell}>
                      <Badge tone={row.status === 'requested' ? 'gold' : 'outline'}>
                        {RETURN_STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
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
            hrefFor={(p) => `/admin/returns?filter=${filter.id}${p > 1 ? `&page=${p}` : ''}`}
          />
        </>
      )}
    </>
  );
}
