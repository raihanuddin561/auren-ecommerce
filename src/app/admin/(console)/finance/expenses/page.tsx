import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ExpensesTable } from '@/components/admin/finance/expenses-table';
import {
  getExpenseCategoriesForAdmin,
  getExpensesForAdmin,
  getMarketingCampaignsForAdmin,
} from '@/modules/finance/queries';

import { requireStaff } from '@/lib/staff';

export const metadata: Metadata = { title: 'Expenses Log | Finance' };

interface ExpensesPageProps {
  searchParams: Promise<{
    categoryId?: string;
    search?: string;
    from?: string;
    to?: string;
  }>;
}

async function ExpensesContent({ searchParams }: ExpensesPageProps) {
  await requireStaff();
  const params = await searchParams;

  const [categories, campaigns, expensesResult] = await Promise.all([
    getExpenseCategoriesForAdmin(),
    getMarketingCampaignsForAdmin(),
    getExpensesForAdmin({
      categoryId: params.categoryId,
      search: params.search,
      from: params.from,
      to: params.to,
      limit: 100,
    }),
  ]);

  return (
    <ExpensesTable
      items={expensesResult.items}
      totalCount={expensesResult.totalCount}
      totalSumFormatted={expensesResult.totalSumFormatted}
      categories={categories}
      campaigns={campaigns}
      selectedCategory={params.categoryId}
      searchQuery={params.search}
    />
  );
}

export default function ExpensesPage(props: ExpensesPageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-fg-muted">Loading atelier expenses log...</div>
      }
    >
      <ExpensesContent {...props} />
    </Suspense>
  );
}
