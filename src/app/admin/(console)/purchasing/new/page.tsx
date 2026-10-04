import Link from 'next/link';
import { PageHeader } from '@/components/admin/page-header';
import { PoForm } from '@/components/admin/purchasing/po-form';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireStaffWith } from '@/lib/staff';
import { listSupplierOptions } from '@/modules/purchasing/queries';

export const metadata = { title: 'New purchase order' };

export default async function NewPurchaseOrderPage() {
  await requireStaffWith('purchasing.manage');
  const suppliers = await listSupplierOptions();
  return (
    <>
      <PageHeader
        title="New purchase order"
        breadcrumb={[
          { label: 'Purchase orders', href: '/admin/purchasing' },
          { label: 'New purchase order' },
        ]}
      />
      {suppliers.length === 0 ? (
        <EmptyState
          title="Add a supplier first"
          description="A purchase order is raised against a supplier."
          action={
            <Button asChild size="sm">
              <Link href="/admin/suppliers/new">New supplier</Link>
            </Button>
          }
        />
      ) : (
        <PoForm suppliers={suppliers} />
      )}
    </>
  );
}
