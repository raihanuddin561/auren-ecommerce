import type { Metadata } from 'next';
import { requireStaff } from '@/lib/staff';
import { CategoriesTable } from '@/components/admin/finance/categories-table';
import { getExpenseCategoriesForAdmin } from '@/modules/finance/queries';

export const metadata: Metadata = { title: 'Expense Categories | Finance' };

export default async function CategoriesPage() {
  await requireStaff();
  const categories = await getExpenseCategoriesForAdmin();

  return <CategoriesTable categories={categories} />;
}
