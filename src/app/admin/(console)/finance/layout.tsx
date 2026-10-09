import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { FinanceNav } from '@/components/admin/finance/finance-nav';
import { requireStaffWith } from '@/lib/staff';

export const metadata: Metadata = { title: 'Finance & Profitability' };

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireStaffWith('finance.read');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Cost Accounting"
        description="Comprehensive atelier financial statements, variable fulfillment costs, operating expenditure, and product contribution margins."
      />
      <FinanceNav />
      {children}
    </div>
  );
}
