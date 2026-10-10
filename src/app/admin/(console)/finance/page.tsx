import { Suspense } from 'react';
import type { Metadata } from 'next';
import { FinanceOverviewStrip } from '@/components/admin/finance/finance-overview-strip';
import { PnLView } from '@/components/admin/finance/pnl-view';
import {
  getFinanceOverviewForAdmin,
  getProfitAndLossReportForAdmin,
} from '@/modules/finance/queries';
import { requireStaff } from '@/lib/staff';
import type { PAndLGrouping, PAndLRecognitionMode } from '@/modules/finance/types';

export const metadata: Metadata = { title: 'P&L Statement | Finance' };

interface FinancePageProps {
  searchParams: Promise<{
    recognitionMode?: string;
    from?: string;
    to?: string;
    grouping?: string;
  }>;
}

async function FinanceContent({ searchParams }: FinancePageProps) {
  await requireStaff();
  const params = await searchParams;

  const recognitionMode: PAndLRecognitionMode =
    params.recognitionMode === 'placed' ? 'placed' : 'delivered';
  const grouping: PAndLGrouping =
    params.grouping === 'day' ? 'day' : params.grouping === 'week' ? 'week' : 'month';

  const [overview, pnlReport] = await Promise.all([
    getFinanceOverviewForAdmin(),
    getProfitAndLossReportForAdmin({
      recognitionMode,
      from: params.from,
      to: params.to,
      grouping,
    }),
  ]);

  return (
    <div className="space-y-6">
      <FinanceOverviewStrip metrics={overview} />
      <PnLView report={pnlReport} />
    </div>
  );
}

export default function FinancePage(props: FinancePageProps) {
  return (
    <Suspense
      fallback={
        <div className="text-stone p-8 text-center text-xs">
          Loading financial statements and ledger metrics...
        </div>
      }
    >
      <FinanceContent {...props} />
    </Suspense>
  );
}
