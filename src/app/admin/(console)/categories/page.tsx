import Link from 'next/link';
import { CategoryTree } from '@/components/admin/catalog/categories/category-tree';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { listCategoryTree } from '@/modules/catalog/queries';

export const metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  const staff = await requireStaffWith('catalog.read');
  const canWrite = hasPermission(staff, 'catalog.write');
  const rows = await listCategoryTree();

  const create = canWrite ? (
    <Button asChild size="sm">
      <Link href="/admin/categories/new">New category</Link>
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Categories"
        description="The menu structure shoppers browse. Use the arrows or drag to change the order within a level."
        actions={create}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Categories group products on the storefront, for example Shirts or Trousers."
          action={create}
        />
      ) : (
        <CategoryTree rows={rows} canWrite={canWrite} />
      )}
    </>
  );
}
