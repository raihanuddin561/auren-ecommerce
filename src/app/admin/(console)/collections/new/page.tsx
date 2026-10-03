import type { Metadata } from 'next';
import { CollectionForm } from '@/components/admin/catalog/collections/collection-form';
import { emptyValues } from '@/components/admin/catalog/collections/form-state';
import { PageHeader } from '@/components/admin/page-header';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { listCategoryOptions } from '@/modules/catalog/queries';

export const metadata: Metadata = {
  title: 'New collection',
  robots: { index: false, follow: false },
};

export default async function NewCollectionPage() {
  // Creating needs write access; readers get the same "not found" as anyone without access.
  const staff = await requireStaffWith('catalog.write');
  const categories = await listCategoryOptions();

  return (
    <>
      <PageHeader
        title="New collection"
        breadcrumb={[{ label: 'Collections', href: '/admin/collections' }, { label: 'New' }]}
        description="Start with the basics. You can add products and a hero image once it is saved."
      />
      <CollectionForm
        initial={emptyValues()}
        savedPublishedAt={null}
        savedState="draft"
        categories={categories.map((c) => ({ id: c.id, label: c.label }))}
        canWrite
        canPublish={hasPermission(staff, 'catalog.publish')}
      />
    </>
  );
}
