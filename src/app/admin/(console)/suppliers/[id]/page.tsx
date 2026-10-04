import { notFound } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/components/admin/page-header';
import { SupplierForm } from '@/components/admin/purchasing/supplier-form';
import { requireStaffWith } from '@/lib/staff';
import { getSupplierForAdmin } from '@/modules/purchasing/queries';

export const metadata = { title: 'Edit supplier' };

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffWith('purchasing.manage');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supplier = await getSupplierForAdmin(id);
  if (!supplier) notFound();

  return (
    <>
      <PageHeader
        title={supplier.name}
        breadcrumb={[{ label: 'Suppliers', href: '/admin/suppliers' }, { label: supplier.name }]}
      />
      <SupplierForm supplier={supplier} canWrite />
    </>
  );
}
