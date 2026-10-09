'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportProfitAndLossCsvAction } from '@/modules/finance/actions';
import type { ProfitAndLossReport } from '@/modules/finance/types';
import { Download, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface PnLViewProps {
  report: ProfitAndLossReport;
}

export function PnLView({ report }: PnLViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const currentMode = report.recognitionMode;

  const handleModeChange = (mode: 'delivered' | 'placed') => {
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('recognitionMode', mode);
      router.push(url.pathname + url.search);
    });
  };

  const handleQuickPeriod = (period: 'today' | '7d' | 'this_month' | 'last_month') => {
    const now = new Date();
    let from = '';
    let to = now.toISOString().split('T')[0] ?? '';

    if (period === 'today') {
      from = to;
    } else if (period === '7d') {
      const past = new Date(now.getTime() - 7 * 86400000);
      from = past.toISOString().split('T')[0] ?? '';
    } else if (period === 'this_month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] ?? '';
    } else if (period === 'last_month') {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0] ?? '';
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0] ?? '';
    }

    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);
      router.push(url.pathname + url.search);
    });
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportProfitAndLossCsvAction({
        recognitionMode: currentMode,
        from: report.dateFrom,
        to: report.dateTo,
      });

      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to export CSV');
        return;
      }

      const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `AUREN-PnL-${report.dateFrom}-to-${report.dateTo}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('P&L CSV downloaded successfully');
    } catch {
      toast.error('An error occurred during export');
    } finally {
      setIsExporting(false);
    }
  };

  const s = report.summary;

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="bg-canvas flex flex-col items-start justify-between gap-4 rounded-sm border border-line p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-stone text-xs font-medium">Revenue Recognition:</span>
          <div className="bg-surface inline-flex rounded-sm border border-line p-0.5">
            <button
              type="button"
              onClick={() => handleModeChange('delivered')}
              disabled={isPending}
              className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
                currentMode === 'delivered'
                  ? 'text-canvas shadow-xs bg-ink font-semibold'
                  : 'text-stone hover:text-ink'
              }`}
            >
              Delivered (Accrual)
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('placed')}
              disabled={isPending}
              className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
                currentMode === 'placed'
                  ? 'text-canvas shadow-xs bg-ink font-semibold'
                  : 'text-stone hover:text-ink'
              }`}
            >
              Placed (Pipeline)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-surface flex items-center gap-1 rounded-sm border border-line p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleQuickPeriod('today')}
              className="text-stone px-2.5 py-1 transition-colors hover:text-ink"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod('7d')}
              className="text-stone px-2.5 py-1 transition-colors hover:text-ink"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod('this_month')}
              className="text-stone px-2.5 py-1 font-medium transition-colors hover:text-ink"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod('last_month')}
              className="text-stone px-2.5 py-1 transition-colors hover:text-ink"
            >
              Last Month
            </button>
          </div>

          <div className="text-stone bg-surface flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-gold" />
            <span>
              {report.dateFrom} → {report.dateTo}
            </span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="gap-1.5 border-line text-xs"
          >
            {isExporting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Financial Statement Card */}
      <div className="bg-canvas overflow-hidden rounded-sm border border-line">
        <div className="bg-surface/50 flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-serif text-base font-semibold text-ink">
              Statement of Profit or Loss
            </h2>
            <p className="text-stone mt-0.5 text-xs">
              Comprehensive atelier earnings statement across all revenue channels and cost centers.
            </p>
          </div>
          <Badge tone={currentMode === 'delivered' ? 'success' : 'gold'}>
            {currentMode === 'delivered'
              ? 'Standard Accounting Recognition'
              : 'Pipeline Projections'}
          </Badge>
        </div>

        <div className="p-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-stone border-b border-line text-left">
                <th className="pb-2.5 font-medium tracking-wider uppercase">Line Item</th>
                <th className="w-44 pb-2.5 text-right font-medium tracking-wider uppercase">
                  Amount (BDT)
                </th>
                <th className="w-36 pb-2.5 text-right font-medium tracking-wider uppercase">
                  % of Net Sales
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {/* REVENUE */}
              <tr className="bg-surface/30">
                <td
                  colSpan={3}
                  className="py-2.5 text-xs font-semibold tracking-wider text-ink uppercase"
                >
                  1. Revenue & Invoiced Sales
                </td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Gross Merchandise Value (GMV)</td>
                <td className="py-2 text-right font-mono text-ink">{s.grossSalesFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Discounts & Promo Redemptions</td>
                <td className="py-2 text-right font-mono text-oxblood">-{s.discountsFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Settled Refunds</td>
                <td className="py-2 text-right font-mono text-oxblood">-{s.refundsFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr className="bg-surface/40 font-semibold">
                <td className="py-2.5 pl-4 text-ink">Net Recognized Sales</td>
                <td className="py-2.5 text-right font-mono text-sm text-ink">
                  {s.netSalesFormatted}
                </td>
                <td className="py-2.5 text-right font-mono text-ink">100.0%</td>
              </tr>

              {/* COGS */}
              <tr className="bg-surface/30">
                <td
                  colSpan={3}
                  className="py-2.5 text-xs font-semibold tracking-wider text-ink uppercase"
                >
                  2. Cost of Goods Sold (COGS)
                </td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">
                  Artisan Fabric, Raw Materials & Finished Tailoring
                </td>
                <td className="py-2 text-right font-mono text-oxblood">-{s.cogsFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr className="bg-gold/5 font-semibold">
                <td className="py-2.5 pl-4 text-gold">Gross Operating Profit</td>
                <td className="py-2.5 text-right font-mono text-sm text-gold">
                  {s.grossProfitFormatted}
                </td>
                <td className="py-2.5 text-right font-mono font-bold text-gold">
                  {s.grossMarginPercent}
                </td>
              </tr>

              {/* VARIABLE FULFILLMENT */}
              <tr className="bg-surface/30">
                <td
                  colSpan={3}
                  className="py-2.5 text-xs font-semibold tracking-wider text-ink uppercase"
                >
                  3. Variable Order Fulfillment & Delivery Logistics
                </td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">
                  Courier Transport & Delivery (Pathao / Steadfast)
                </td>
                <td className="text-stone py-2 text-right font-mono">-{s.shippingCostFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Payment Gateway & Acquiring Fees</td>
                <td className="text-stone py-2 text-right font-mono">-{s.gatewayFeesFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Cash on Delivery (COD) Remittance Charges</td>
                <td className="text-stone py-2 text-right font-mono">-{s.codFeesFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Luxury Presentation Boxes & Packaging</td>
                <td className="text-stone py-2 text-right font-mono">-{s.packagingFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Return Delivery & RTO Restocking Losses</td>
                <td className="text-stone py-2 text-right font-mono">
                  -{s.returnsAndRtoCostFormatted}
                </td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr className="bg-surface/40 font-semibold">
                <td className="py-2.5 pl-4 text-ink">Order Contribution Margin</td>
                <td className="py-2.5 text-right font-mono text-sm text-ink">
                  {s.contributionMarginFormatted}
                </td>
                <td className="py-2.5 text-right font-mono text-ink">
                  {s.contributionMarginPercent}
                </td>
              </tr>

              {/* OPERATING EXPENSES */}
              <tr className="bg-surface/30">
                <td
                  colSpan={3}
                  className="py-2.5 text-xs font-semibold tracking-wider text-ink uppercase"
                >
                  4. Atelier Operating Expenses (OpEx)
                </td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Performance Advertising & Social Campaigns</td>
                <td className="text-stone py-2 text-right font-mono">
                  -{s.marketingSpendFormatted}
                </td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Master Tailors, Artisans & Staff Payroll</td>
                <td className="text-stone py-2 text-right font-mono">-{s.payrollFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Banani Atelier Studio & Showroom Lease</td>
                <td className="text-stone py-2 text-right font-mono">-{s.rentFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">Studio Utilities, Power & Generator Diesel</td>
                <td className="text-stone py-2 text-right font-mono">-{s.utilitiesFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">
                  Cloud Infrastructure & Software Subscriptions
                </td>
                <td className="text-stone py-2 text-right font-mono">-{s.softwareFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr>
                <td className="text-stone py-2 pl-4">
                  Audit, Legal, Editorial Photography & Sundries
                </td>
                <td className="text-stone py-2 text-right font-mono">-{s.otherOpexFormatted}</td>
                <td className="text-stone py-2 text-right font-mono">-</td>
              </tr>
              <tr className="bg-surface/40 font-semibold">
                <td className="py-2.5 pl-4 text-oxblood">Total Operating Expenses</td>
                <td className="py-2.5 text-right font-mono text-sm text-oxblood">
                  -{s.totalOpexFormatted}
                </td>
                <td className="text-stone py-2.5 text-right font-mono">-</td>
              </tr>

              {/* BOTTOM LINE */}
              <tr className="text-canvas bg-ink font-bold">
                <td className="py-3 pl-4 text-sm tracking-wider uppercase">Net Operating Income</td>
                <td className="py-3 text-right font-mono text-base font-medium">
                  {s.netProfitFormatted}
                </td>
                <td className="py-3 text-right font-mono text-sm text-gold">
                  {s.netMarginPercent}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
