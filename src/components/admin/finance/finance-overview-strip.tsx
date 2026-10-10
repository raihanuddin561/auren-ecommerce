import { Badge } from '@/components/ui/badge';
import type { FinanceOverviewMetrics } from '@/modules/finance/types';
import { TrendingUp, Wallet, ArrowDownRight, Sparkles } from 'lucide-react';

interface FinanceOverviewStripProps {
  metrics: FinanceOverviewMetrics;
}

export function FinanceOverviewStrip({ metrics }: FinanceOverviewStripProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-canvas rounded-sm border border-line p-4">
        <div className="flex items-center justify-between">
          <span className="text-stone text-xs font-medium tracking-wider uppercase">
            Net Sales (MTD)
          </span>
          <div className="rounded-sm bg-gold/10 p-1.5 text-gold">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 font-serif text-xl font-medium tracking-tight text-ink">
          {metrics.currentMonthNetSales}
        </p>
        <div className="text-stone mt-1 flex items-center gap-1.5 text-xs">
          <span>Gross Margin:</span>
          <Badge tone="gold" className="px-1.5 py-0">
            {metrics.currentMonthGrossMarginPercent}
          </Badge>
        </div>
      </div>

      <div className="bg-canvas rounded-sm border border-line p-4">
        <div className="flex items-center justify-between">
          <span className="text-stone text-xs font-medium tracking-wider uppercase">
            Gross Profit (MTD)
          </span>
          <div className="rounded-sm bg-surface-subtle p-1.5 text-ink">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 font-serif text-xl font-medium tracking-tight text-ink">
          {metrics.currentMonthGrossProfit}
        </p>
        <p className="text-stone mt-1 text-xs">Revenue minus product COGS</p>
      </div>

      <div className="bg-canvas rounded-sm border border-line p-4">
        <div className="flex items-center justify-between">
          <span className="text-stone text-xs font-medium tracking-wider uppercase">
            Total OpEx (MTD)
          </span>
          <div className="rounded-sm bg-oxblood/10 p-1.5 text-oxblood">
            <ArrowDownRight className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 font-serif text-xl font-medium tracking-tight text-ink">
          {metrics.currentMonthTotalExpenses}
        </p>
        <p className="text-stone mt-1 text-xs">Recurring: {metrics.monthlyRecurringSpend}/mo</p>
      </div>

      <div className="bg-canvas rounded-sm border border-line p-4">
        <div className="flex items-center justify-between">
          <span className="text-stone text-xs font-medium tracking-wider uppercase">
            Net Operating Income
          </span>
          <div className="rounded-sm bg-success/10 p-1.5 text-success">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 font-serif text-xl font-medium tracking-tight text-ink">
          {metrics.currentMonthNetProfit}
        </p>
        <div className="text-stone mt-1 flex items-center gap-1.5 text-xs">
          <span>Net Margin:</span>
          <Badge tone="success" className="px-1.5 py-0">
            {metrics.currentMonthNetMarginPercent}
          </Badge>
        </div>
      </div>
    </div>
  );
}
