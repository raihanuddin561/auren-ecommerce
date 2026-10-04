import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { PageHeader } from '@/components/admin/page-header';
import { PoForm } from '@/components/admin/purchasing/po-form';
import { requireStaffWith } from '@/lib/staff';
import { getPurchaseOrderForAdmin, listSupplierOptions } from '@/modules/purchasing/queries';

export const metadata = { title: 'Edit purchase order' };

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffWith('purchasing.manage');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [order, suppliers] = await Promise.all([
    getPurchaseOrderForAdmin(id),
    listSupplierOptions(),
  ]);
  if (!order) notFound();
  // Only a draft can be edited; anything else goes back to the read-only view.
  if (!order.can.edit) redirect(`/admin/purchasing/${id}`);

  return (
    <>
      <PageHeader
        title={`Edit ${order.poNumber}`}
        breadcrumb={[
          { label: 'Purchase orders', href: '/admin/purchasing' },
          { label: order.poNumber, href: `/admin/purchasing/${id}` },
          { label: 'Edit' },
        ]}
      />
      <PoForm
        suppliers={suppliers}
        order={{
          id: order.id,
          poNumber: order.poNumber,
          supplierId: order.supplier.id,
          expectedAt: order.expectedAtInput,
          notes: order.notes ?? '',
          lines: order.lines.map((line) => ({
            variantId: line.variantId,
            label: line.label,
            sku: line.sku,
            quantityOrdered: String(line.quantityOrdered),
            unitCost: line.unitCostInput,
          })),
        }}
      />
    </>
  );
}
