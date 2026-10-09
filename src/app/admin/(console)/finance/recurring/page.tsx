import type { Metadata } from 'next';
import { RecurringTable } from '@/components/admin/finance/recurring-table';
import {
  getExpenseCategoriesForAdmin,
  getRecurringExpensesForAdmin,
} from '@/modules/finance/queries';

export const metadata: Metadata = { title: 'Recurring Commitments | Finance' };

export default async function RecurringPage() {
  const [recurring, categories] = await Promise.all([
    getRecurringExpensesForAdmin(),
    getExpenseCategoriesForAdmin(),
  ]);

  return <RecurringTable recurring={recurring} categories={categories} />;
}
