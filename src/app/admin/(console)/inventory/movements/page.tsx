import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { listStockMovements } from '@/modules/inventory/queries';
import { movementListSchema } from '@/modules/inventory/schemas';

export const metadata: Metadata = { title: 'Stock movements' };

const TYPE_LABEL: Record<string, string> = {
  receipt: 'Receipt',
  sale: 'Sale',
  reservation: 'Reserved',
  release: 'Released',
  return_restock: 'Return restock',
  adjustment: 'Adjustment',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  write_off: 'Write-off',
};

const when = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-top';

const href = (variant: string | undefined, type: string | undefined, page: number) => {
  const params = new URLSearchParams();
  if (variant) params.set('variant', variant);
  if (type) params.set('type', type);
  if (page > 1) params.set('page', String(page));
  const text = params.toString();
  return `/admin/inventory/movements${text ? `?${text}` : ''}`;
};

/** Reservations appear in the ledger too: they explain the reserved column. */
export default async function MovementsPage({
  searchParams,
}: PageProps<'/admin/inventory/movements'>) {
  const staff = await requireStaffWith('inventory.read');
  const canSeeCost =
    hasPermission(staff, 'purchasing.manage') || hasPermission(staff, 'finance.read');
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const parsed = movementListSchema.safeParse({
    ...(one(raw.variant) ? { variantId: one(raw.variant) } : {}),
    ...(one(raw.type) ? { type: one(raw.type) } : {}),
    ...(one(raw.page) ? { page: one(raw.page) } : {}),
  });
  const params = parsed.success ? parsed.data : { page: 1 };
  const result = await listStockMovements(params);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <>
      <PageHeader
        title="Stock movements"
        description={
          result.label
            ? `Every change to ${result.label.productTitle} (${result.label.sku}), newest first.`
            : 'Every change to stock, newest first. Rows are never edited or removed.'
        }
        breadcrumb={[{ label: 'Inventory', href: '/admin/inventory' }, { label: 'Movements' }]}
        actions={
          params.variantId ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/inventory/movements">All variants</Link>
            </Button>
          ) : undefined
        }
      />
      <nav aria-label="Filter by type" className="mb-6 flex flex-wrap gap-2">
        {[undefined, ...Object.keys(TYPE_LABEL)].map((type) => (
          <Button
            key={type ?? 'all'}
            asChild
            size="sm"
            variant={params.type === type ? 'primary' : 'secondary'}
          >
            <Link
              href={href(params.variantId, type, 1)}
              aria-current={params.type === type ? 'page' : undefined}
            >
              {type ? TYPE_LABEL[type] : 'All types'}
            </Link>
          </Button>
        ))}
      </nav>
      {result.rows.length === 0 ? (
        <EmptyState
          title="No movements yet"
          description="Receive a purchase order or adjust stock and the ledger fills in."
        />
      ) : (
        <>
          <div className="overflow-x-auto border border-line bg-raised">
            <table className="w-full border-collapse type-admin">
              <caption className="sr-only">Stock movement ledger</caption>
              <thead>
                <tr>
                  <th scope="col" className={head}>
                    When (UTC)
                  </th>
                  <th scope="col" className={head}>
                    Type
                  </th>
                  <th scope="col" className={head}>
                    Variant
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    Quantity
                  </th>
                  {canSeeCost ? (
                    <th scope="col" className={cn(head, 'hidden text-right md:table-cell')}>
                      Unit cost
                    </th>
                  ) : null}
                  <th scope="col" className={cn(head, 'hidden lg:table-cell')}>
                    Reason or reference
                  </th>
                  <th scope="col" className={cn(head, 'hidden lg:table-cell')}>
                    By
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-b-0">
                    <td className={cn(cell, 'whitespace-nowrap')}>
                      {when.format(new Date(row.createdAt))}
                    </td>
                    <td className={cell}>
                      <Badge tone="outline">{TYPE_LABEL[row.type] ?? row.type}</Badge>
                    </td>
                    <td className={cell}>
                      <Link
                        href={href(row.variantId, undefined, 1)}
                        className="underline decoration-gold underline-offset-4"
                      >
                        {row.productTitle}
                      </Link>
                      <div className="type-small font-mono text-fg-muted">{row.sku}</div>
                    </td>
                    <td className={cn(cell, 'text-right font-medium tabular-nums')}>
                      {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                    </td>
                    {canSeeCost ? (
                      <td className={cn(cell, 'hidden text-right tabular-nums md:table-cell')}>
                        {row.unitCost ?? ''}
                      </td>
                    ) : null}
                    <td className={cn(cell, 'hidden text-fg-muted lg:table-cell')}>
                      {row.reason ?? row.referenceType ?? ''}
                    </td>
                    <td className={cn(cell, 'hidden text-fg-muted lg:table-cell')}>
                      {row.actorName ?? 'System'}
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
            hrefFor={(page) => href(params.variantId, params.type, page)}
          />
        </>
      )}
    </>
  );
}
