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
      <div className="flex flex-col items-start justify-between gap-4 rounded-sm border border-line bg-raised p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-fg-muted">Revenue Recognition:</span>
          <div className="inline-flex rounded-sm border border-line bg-sunken p-0.5">
            <button
              type="button"
              onClick={() => handleModeChange('delivered')}
              disabled={isPending}
              className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
                currentMode === 'delivered'
                  ? 'shadow-xs bg-ink font-semibold text-ivory'
                  : 'text-fg-muted hover:text-fg'
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
                  ? 'shadow-xs bg-ink font-semibold text-ivory'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              Placed (Pipeline)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-sm border border-line bg-sunken p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleQuickPeriod('today')}
              className="px-2.5 py-1 text-fg-muted transition-colors hover:text-fg"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod('7d')}
              className="px-2.5 py-1 text-fg-muted transition-colors hover:text-fg"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod('this_month')}
              className="px-2.5 py-1 font-medium text-fg-muted transition-colors hover:text-fg"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleQuickPeriod('last_month')}
              className="px-2.5 py-1 text-fg-muted transition-colors hover:text-fg"
            >
              Last Month
            </button>
          </div>

          <div className="flex items-center gap-1.5 rounded-sm border border-line bg-sunken px-2.5 py-1.5 text-xs text-fg-muted">
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
      <div className="overflow-hidden rounded-sm border border-line bg-raised">
        <div className="flex items-center justify-between border-b border-line bg-sunken/50 px-6 py-4">
          <div>
            <h2 className="font-serif text-base font-semibold text-fg">
              Statement of Profit or Loss
            </h2>
            <p className="mt-0.5 text-xs text-fg-muted">
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
              <tr className="border-b border-line text-left text-fg-muted">
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
              <tr className="bg-sunken/40">
                <td
                  colSpan={3}
                  className="py-2.5 text-xs font-semibold tracking-wider text-fg uppercase"
                >
                  1. Revenue &amp; Invoiced Sales
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">Gross Merchandise Value (GMV)</td>
                <td className="py-2 text-right font-mono text-fg">{s.grossSalesFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">Discounts &amp; Promo Redemptions</td>
                <td className="py-2 text-right font-mono text-oxblood">-{s.discountsFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">Settled Refunds</td>
                <td className="py-2 text-right font-mono text-oxblood">-{s.refundsFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr className="bg-sunken/60 font-semibold">
                <td className="py-2.5 pl-4 text-fg">Net Recognized Sales</td>
                <td className="py-2.5 text-right font-mono text-sm text-fg">
                  {s.netSalesFormatted}
                </td>
                <td className="py-2.5 text-right font-mono text-fg">100.0%</td>
              </tr>

              {/* COGS */}
              <tr className="bg-sunken/40">
                <td
                  colSpan={3}
                  className="py-2.5 text-xs font-semibold tracking-wider text-fg uppercase"
                >
                  2. Cost of Goods Sold (COGS)
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Artisan Fabric, Raw Materials &amp; Finished Tailoring
                </td>
                <td className="py-2 text-right font-mono text-oxblood">-{s.cogsFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr className="bg-gold/10 font-semibold">
                <td className="py-2.5 pl-4 text-gold">Gross Operating Profit</td>
                <td className="py-2.5 text-right font-mono text-sm text-gold">
                  {s.grossProfitFormatted}
                </td>
                <td className="py-2.5 text-right font-mono font-bold text-gold">
                  {s.grossMarginPercent}
                </td>
              </tr>

              {/* VARIABLE FULFILLMENT */}
              <tr className="bg-sunken/40">
                <td
                  colSpan={3}
                  className="py-2.5 text-xs font-semibold tracking-wider text-fg uppercase"
                >
                  3. Variable Order Fulfillment &amp; Delivery Logistics
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Courier Transport &amp; Delivery (Pathao / Steadfast)
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">
                  -{s.shippingCostFormatted}
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">Payment Gateway &amp; Acquiring Fees</td>
                <td className="py-2 text-right font-mono text-fg-muted">
                  -{s.gatewayFeesFormatted}
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Cash on Delivery (COD) Remittance Charges
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-{s.codFeesFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Luxury Presentation Boxes &amp; Packaging
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-{s.packagingFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Return Delivery &amp; RTO Restocking Losses
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">
                  -{s.returnsAndRtoCostFormatted}
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr className="bg-sunken/60 font-semibold">
                <td className="py-2.5 pl-4 text-fg">Order Contribution Margin</td>
                <td className="py-2.5 text-right font-mono text-sm text-fg">
                  {s.contributionMarginFormatted}
                </td>
                <td className="py-2.5 text-right font-mono text-fg">
                  {s.contributionMarginPercent}
                </td>
              </tr>

              {/* OPERATING EXPENSES */}
              <tr className="bg-sunken/40">
                <td
                  colSpan={3}
                  className="py-2.5 text-xs font-semibold tracking-wider text-fg uppercase"
                >
                  4. Atelier Operating Expenses (OpEx)
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Performance Advertising &amp; Social Campaigns
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">
                  -{s.marketingSpendFormatted}
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Master Tailors, Artisans &amp; Staff Payroll
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-{s.payrollFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Banani Atelier Studio &amp; Showroom Lease
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-{s.rentFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Studio Utilities, Power &amp; Generator Diesel
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-{s.utilitiesFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Cloud Infrastructure &amp; Software Subscriptions
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-{s.softwareFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-fg-muted">
                  Audit, Legal, Editorial Photography &amp; Sundries
                </td>
                <td className="py-2 text-right font-mono text-fg-muted">-{s.otherOpexFormatted}</td>
                <td className="py-2 text-right font-mono text-fg-muted">-</td>
              </tr>
              <tr className="bg-sunken/60 font-semibold">
                <td className="py-2.5 pl-4 text-oxblood">Total Operating Expenses</td>
                <td className="py-2.5 text-right font-mono text-sm text-oxblood">
                  -{s.totalOpexFormatted}
                </td>
                <td className="py-2.5 text-right font-mono text-fg-muted">-</td>
              </tr>

              {/* BOTTOM LINE */}
              <tr className="bg-ink font-bold text-ivory">
                <td className="py-3 pl-4 text-sm tracking-wider text-ivory uppercase">
                  Net Operating Income
                </td>
                <td className="py-3 text-right font-mono text-base font-medium text-ivory">
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
