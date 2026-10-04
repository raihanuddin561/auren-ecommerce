import { PageHeader } from '@/components/admin/page-header';
import { SupplierForm } from '@/components/admin/purchasing/supplier-form';
import { requireStaffWith } from '@/lib/staff';

export const metadata = { title: 'New supplier' };

export default async function NewSupplierPage() {
  await requireStaffWith('purchasing.manage');
  return (
    <>
      <PageHeader
        title="New supplier"
        breadcrumb={[{ label: 'Suppliers', href: '/admin/suppliers' }, { label: 'New supplier' }]}
      />
      <SupplierForm canWrite />
    </>
  );
}
