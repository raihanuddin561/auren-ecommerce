import { notFound } from 'next/navigation';
import { z } from 'zod';
import { CategoryDeleteSection } from '@/components/admin/catalog/categories/category-delete-section';
import { CategoryForm } from '@/components/admin/catalog/categories/category-form';
import { CategoryImageSection } from '@/components/admin/catalog/categories/category-image-section';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { getCategoryForEdit, listCategoryTree } from '@/modules/catalog/queries';

export const metadata = { title: 'Edit category' };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffWith('catalog.read');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [category, rows] = await Promise.all([getCategoryForEdit(id), listCategoryTree()]);
  if (!category) notFound();

  const canWrite = hasPermission(staff, 'catalog.write');
  const row = rows.find((candidate) => candidate.id === id);

  return (
    <>
      <PageHeader
        title={category.name}
        breadcrumb={[{ label: 'Categories', href: '/admin/categories' }, { label: category.name }]}
        actions={
          <Badge tone={category.isActive ? 'success' : 'outline'}>
            {category.isActive ? 'Active' : 'Hidden'}
          </Badge>
        }
      />
      <div className="flex flex-col gap-6">
        <CategoryForm category={category} rows={rows} canWrite={canWrite} />
        {canWrite ? (
          <>
            <CategoryImageSection
              categoryId={category.id}
              image={category.image ? { url: category.image, alt: category.imageAlt ?? '' } : null}
            />
            <CategoryDeleteSection
              id={category.id}
              name={category.name}
              productCount={row?.productCount ?? 0}
              childCount={row?.childCount ?? 0}
            />
          </>
        ) : null}
      </div>
    </>
  );
}
