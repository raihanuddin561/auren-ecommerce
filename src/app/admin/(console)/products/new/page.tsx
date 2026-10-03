import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { NewProductForm } from '@/components/admin/catalog/products/new-product-form';
import { requireStaffWith } from '@/lib/staff';
import { listCategoryOptions } from '@/modules/catalog/queries';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  await requireStaffWith('catalog.write');
  const categories = await listCategoryOptions();
  return (
    <>
      <PageHeader
        title="New product"
        description="The product starts as a draft. Shoppers cannot see it until you publish it."
        breadcrumb={[{ label: 'Products', href: '/admin/products' }, { label: 'New product' }]}
      />
      <NewProductForm categories={categories.map((c) => ({ id: c.id, label: c.label }))} />
    </>
  );
}
