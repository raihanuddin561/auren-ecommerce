import { z } from 'zod';
import { CategoryForm } from '@/components/admin/catalog/categories/category-form';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';
import { listCategoryTree } from '@/modules/catalog/queries';

export const metadata = { title: 'New category' };

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaffWith('catalog.write');
  const [{ parent }, rows] = await Promise.all([searchParams, listCategoryTree()]);
  const parentId = z.uuid().safeParse(parent).data ?? null;

  return (
    <>
      <PageHeader
        title="New category"
        breadcrumb={[{ label: 'Categories', href: '/admin/categories' }, { label: 'New category' }]}
      />
      <CategoryForm rows={rows} canWrite initialParentId={parentId} />
    </>
  );
}
