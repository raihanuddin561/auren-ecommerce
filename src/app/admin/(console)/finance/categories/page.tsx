import type { Metadata } from 'next';
import { CategoriesTable } from '@/components/admin/finance/categories-table';
import { getExpenseCategoriesForAdmin } from '@/modules/finance/queries';

export const metadata: Metadata = { title: 'Expense Categories | Finance' };

export default async function CategoriesPage() {
  const categories = await getExpenseCategoriesForAdmin();

  return <CategoriesTable categories={categories} />;
}
