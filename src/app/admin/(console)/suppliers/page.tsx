import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireStaffWith } from '@/lib/staff';
import { listSuppliersForAdmin } from '@/modules/purchasing/queries';

export const metadata: Metadata = { title: 'Suppliers' };

const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

export default async function SuppliersPage({ searchParams }: PageProps<'/admin/suppliers'>) {
  await requireStaffWith('purchasing.manage');
  const raw = await searchParams;
  const showInactive = raw.inactive === '1';
  const suppliers = await listSuppliersForAdmin({ includeInactive: showInactive });

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="The factories and agents you buy from. Purchase orders are raised against a supplier."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href={showInactive ? '/admin/suppliers' : '/admin/suppliers?inactive=1'}>
                {showInactive ? 'Hide inactive' : 'Show inactive'}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/suppliers/new">New supplier</Link>
            </Button>
          </>
        }
      />
      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="Add the first supplier, then raise a purchase order to bring stock in."
          action={
            <Button asChild size="sm">
              <Link href="/admin/suppliers/new">New supplier</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto border border-line bg-raised">
          <table className="w-full border-collapse type-admin">
            <caption className="sr-only">Suppliers</caption>
            <thead>
              <tr>
                <th scope="col" className={head}>
                  Name
                </th>
                <th scope="col" className={`${head} hidden md:table-cell`}>
                  Contact
                </th>
                <th scope="col" className={`${head} hidden lg:table-cell`}>
                  Payment terms
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Orders
                </th>
                <th scope="col" className={head}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b border-line last:border-b-0">
                  <td className={cell}>
                    <Link
                      href={`/admin/suppliers/${supplier.id}`}
                      className="font-medium text-fg underline decoration-gold decoration-1 underline-offset-4 hover:decoration-2"
                    >
                      {supplier.name}
                    </Link>
                  </td>
                  <td className={`${cell} hidden md:table-cell`}>
                    {[supplier.contactName, supplier.phone].filter(Boolean).join(' · ') || (
                      <span className="text-fg-muted">None</span>
                    )}
                  </td>
                  <td className={`${cell} hidden lg:table-cell`}>
                    {supplier.paymentTerms ?? <span className="text-fg-muted">None</span>}
                  </td>
                  <td className={`${cell} text-right tabular-nums`}>{supplier.orderCount}</td>
                  <td className={cell}>
                    <Badge tone={supplier.isActive ? 'outline' : 'neutral'}>
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
