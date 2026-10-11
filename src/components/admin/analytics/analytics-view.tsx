'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { KpiCard } from '@/components/admin/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import type { AnalyticsOverview, AnalyticsTimeRange } from '@/modules/analytics/types';

interface AnalyticsViewProps {
  data: AnalyticsOverview;
}

const RANGES: Array<{ id: AnalyticsTimeRange; label: string }> = [
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: '12m', label: 'Last 12 Months' },
  { id: 'all', label: 'All Time' },
];

export function AnalyticsView({ data }: AnalyticsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = (searchParams.get('range') as AnalyticsTimeRange) || data.timeRange || '30d';

  const handleRangeChange = (range: AnalyticsTimeRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', range);
    router.push(`/admin/analytics?${params.toString()}`);
  };

  const maxDailyRevenue = Math.max(...data.trends.map((t) => Number(t.netSalesMinor)), 1);

  return (
    <div className="space-y-8">
      {/* Header & Range Filters */}
      <PageHeader
        title="Intelligence & Analytics"
        description="Comprehensive commercial metrics, sales channels, customer cohorts, and operational verification performance."
        actions={
          <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-line bg-raised p-1">
            {RANGES.map((r) => {
              const active = currentRange === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRangeChange(r.id)}
                  className={cn(
                    'rounded-xs px-3 py-1.5 type-caption font-medium transition-auren-fast',
                    active
                      ? 'shadow-xs bg-page text-fg ring-1 ring-gold/40'
                      : 'text-fg-muted hover:bg-sunken hover:text-fg',
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        }
      />

      {/* KPI Headline Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Net Sales"
          value={data.kpis.netSalesFormatted || '৳0'}
          delta={{
            value: `${data.kpis.netSalesGrowthPercent >= 0 ? '+' : ''}${data.kpis.netSalesGrowthPercent}%`,
            direction: data.kpis.netSalesGrowthPercent >= 0 ? 'up' : 'down',
            tone: data.kpis.netSalesGrowthPercent >= 0 ? 'good' : 'bad',
            comparedTo: 'prior period',
          }}
          footnote="All confirmed & active commissions"
        />

        <KpiCard
          label="Commissions (Orders)"
          value={data.kpis.ordersCount}
          delta={{
            value: `${data.kpis.ordersGrowthPercent >= 0 ? '+' : ''}${data.kpis.ordersGrowthPercent}%`,
            direction: data.kpis.ordersGrowthPercent >= 0 ? 'up' : 'down',
            tone: data.kpis.ordersGrowthPercent >= 0 ? 'good' : 'bad',
            comparedTo: 'prior period',
          }}
          footnote={`${data.kpis.unitsSold} total units crafted`}
        />

        <KpiCard
          label="Average Order Value"
          value={data.kpis.aovFormatted || '৳0'}
          footnote="Basket size per transaction"
        />

        <KpiCard
          label="Delivered Revenue"
          value={data.kpis.deliveredSalesFormatted || '৳0'}
          footnote="Fulfilled & completed orders"
        />

        <KpiCard
          label="Patron Repeat Rate"
          value={`${data.customers.repeatCustomerRatePercent}%`}
          footnote={`${data.customers.returningCustomersCount} returning patrons`}
        />

        <KpiCard
          label="Verification SLA"
          value={`${data.verification.slaCompliancePercent}%`}
          delta={{
            value: `${data.verification.medianMinutesToVerify}m median`,
            direction: 'flat',
            tone: data.verification.slaCompliancePercent >= 90 ? 'good' : 'bad',
            comparedTo: 'target 120m',
          }}
          footnote="Phone verification speed"
        />
      </div>

      {/* Revenue & Sales Volume Trend Section */}
      <section className="rounded-xs border border-line bg-raised p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="type-eyebrow text-accent-text">COMMERCIAL REVENUE</span>
            <h2 className="mt-1 type-h3 font-sans font-medium text-fg">
              Daily Revenue & Order Volume
            </h2>
          </div>
          <div className="flex items-center gap-4 type-caption font-mono text-fg-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-gold" /> Net Sales (৳)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-line-strong" /> Order Count
            </span>
          </div>
        </div>

        {data.trends.length === 0 ? (
          <div className="mt-8 flex h-48 items-center justify-center rounded-xs border border-dashed border-line bg-sunken type-small text-fg-muted">
            No sales recorded during this date window.
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="flex h-56 items-end gap-1.5 sm:gap-2">
              {data.trends.map((point) => {
                const heightPercent = Math.max(
                  Math.round((Number(point.netSalesMinor) / maxDailyRevenue) * 100),
                  6,
                );
                return (
                  <div
                    key={point.date}
                    className="group relative flex h-full flex-1 flex-col items-center justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute bottom-full z-20 mb-2 hidden w-36 rounded-xs border border-line bg-page p-2.5 type-caption shadow-float group-hover:block">
                      <p className="font-mono text-fg-muted">{point.date}</p>
                      <p className="mt-1 font-medium text-fg">{point.netSalesFormatted}</p>
                      <p className="type-small text-accent-text">
                        {point.ordersCount} order{point.ordersCount !== 1 ? 's' : ''} (
                        {point.unitsSold} units)
                      </p>
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full rounded-t-xs bg-gold/80 transition-all duration-300 group-hover:bg-gold"
                    />
                  </div>
                );
              })}
            </div>

            {/* Timeline date axis */}
            <div className="flex justify-between border-t border-line pt-2 type-caption font-mono text-fg-muted">
              <span>{data.trends[0]?.date}</span>
              {data.trends.length > 2 && (
                <span>{data.trends[Math.floor(data.trends.length / 2)]?.date}</span>
              )}
              <span>{data.trends[data.trends.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </section>

      {/* Order Journey Funnel */}
      <section className="rounded-xs border border-line bg-raised p-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="type-eyebrow text-accent-text">COMMERCE PIPELINE</span>
            <h2 className="mt-1 type-h3 font-sans font-medium text-fg">
              Order Journey & Fulfillment Funnel
            </h2>
          </div>
          <Badge tone="outline">{data.funnel.placed} Total Inbound</Badge>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xs border border-line bg-page p-4">
            <div className="flex items-center justify-between type-caption text-fg-muted">
              <span>01 / PLACED</span>
              <Icon icon={ShoppingBag} size={16} />
            </div>
            <p className="mt-2 type-h2 font-medium text-fg tabular-nums">{data.funnel.placed}</p>
            <p className="mt-1 type-small text-fg-muted">Inbound checkouts placed</p>
          </div>

          <div className="rounded-xs border border-line bg-page p-4">
            <div className="flex items-center justify-between type-caption text-fg-muted">
              <span>02 / VERIFIED</span>
              <span className="font-mono text-accent-text">
                {data.funnel.verificationRatePercent}%
              </span>
            </div>
            <p className="mt-2 type-h2 font-medium text-fg tabular-nums">{data.funnel.verified}</p>
            <p className="mt-1 type-small text-fg-muted">Confirmed by staff concierge</p>
          </div>

          <div className="rounded-xs border border-line bg-page p-4">
            <div className="flex items-center justify-between type-caption text-fg-muted">
              <span>03 / DISPATCHED</span>
              <span className="font-mono text-accent-text">
                {data.funnel.fulfillmentRatePercent}%
              </span>
            </div>
            <p className="mt-2 type-h2 font-medium text-fg tabular-nums">
              {data.funnel.dispatched}
            </p>
            <p className="mt-1 type-small text-fg-muted">Handed to Pathao / Steadfast</p>
          </div>

          <div className="rounded-xs border border-line bg-page p-4">
            <div className="flex items-center justify-between type-caption text-fg-muted">
              <span>04 / DELIVERED</span>
              <span className="font-mono text-accent-text">
                {data.funnel.deliverySuccessRatePercent}%
              </span>
            </div>
            <p className="mt-2 type-h2 font-medium text-fg tabular-nums">{data.funnel.delivered}</p>
            <p className="mt-1 type-small text-fg-muted">Client accepted delivery</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-line/60 pt-3 type-small text-fg-muted">
          <span>
            Cancelled: <strong className="text-danger-text">{data.funnel.cancelled}</strong>
          </span>
          <span>
            Returns / Exchanges: <strong className="text-fg">{data.funnel.returned}</strong>
          </span>
        </div>
      </section>

      {/* Multi-Dimensional Breakdowns Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales by Channel */}
        <section className="rounded-xs border border-line bg-raised p-6">
          <span className="type-eyebrow text-accent-text">CHANNELS</span>
          <h3 className="mt-1 type-h3 font-sans font-medium text-fg">Acquisition Channels</h3>
          <p className="mt-1 type-small text-fg-muted">Revenue contribution by touchpoint</p>

          <div className="mt-6 space-y-4">
            {data.channels.length === 0 ? (
              <p className="type-small text-fg-muted">No channel data available.</p>
            ) : (
              data.channels.map((ch) => (
                <div key={ch.channel} className="space-y-1.5">
                  <div className="flex justify-between type-small">
                    <span className="font-medium text-fg">{ch.channelLabel}</span>
                    <span className="font-mono text-fg-muted">
                      {ch.revenueFormatted} ({ch.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-xs bg-sunken">
                    <div
                      style={{ width: `${ch.percentage}%` }}
                      className="h-full rounded-xs bg-gold transition-all duration-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Category Contribution */}
        <section className="rounded-xs border border-line bg-raised p-6">
          <span className="type-eyebrow text-accent-text">MERCHANDISE</span>
          <h3 className="mt-1 type-h3 font-sans font-medium text-fg">Category Breakdown</h3>
          <p className="mt-1 type-small text-fg-muted">Gross sales share across garments</p>

          <div className="mt-6 space-y-4">
            {data.categories.length === 0 ? (
              <p className="type-small text-fg-muted">No category data recorded.</p>
            ) : (
              data.categories.map((cat) => (
                <div key={cat.categoryId} className="space-y-1.5">
                  <div className="flex justify-between type-small">
                    <span className="font-medium text-fg">{cat.categoryName}</span>
                    <span className="font-mono text-fg-muted">
                      {cat.revenueFormatted} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-xs bg-sunken">
                    <div
                      style={{ width: `${cat.percentage}%` }}
                      className="h-full rounded-xs bg-accent-text transition-all duration-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Customer Cohort Breakdown */}
        <section className="rounded-xs border border-line bg-raised p-6">
          <span className="type-eyebrow text-accent-text">PATRONAGE</span>
          <h3 className="mt-1 type-h3 font-sans font-medium text-fg">Client Retention</h3>
          <p className="mt-1 type-small text-fg-muted">New patrons vs returning clientele</p>

          <div className="mt-6 space-y-5">
            <div className="rounded-xs border border-line bg-page p-4">
              <div className="flex items-center justify-between type-small">
                <span className="font-medium text-fg">New Patrons</span>
                <span className="font-mono text-accent-text">
                  {data.customers.newCustomersCount} clients
                </span>
              </div>
              <p className="mt-1 type-h3 font-medium text-fg">
                {data.customers.newCustomerRevenueFormatted}
              </p>
              <p className="mt-1 type-caption text-fg-muted">First atelier commissions</p>
            </div>

            <div className="rounded-xs border border-line bg-page p-4">
              <div className="flex items-center justify-between type-small">
                <span className="font-medium text-fg">Returning Clientele</span>
                <span className="font-mono text-gold">
                  {data.customers.returningCustomersCount} clients
                </span>
              </div>
              <p className="mt-1 type-h3 font-medium text-fg">
                {data.customers.returningCustomerRevenueFormatted}
              </p>
              <p className="mt-1 type-caption text-fg-muted">Repeat wardrobe commissions</p>
            </div>
          </div>
        </section>
      </div>

      {/* Top Performing Garments Table */}
      <section className="overflow-hidden rounded-xs border border-line bg-raised">
        <div className="border-b border-line p-6">
          <span className="type-eyebrow text-accent-text">SIGNATURE PIECES</span>
          <h3 className="mt-1 type-h3 font-sans font-medium text-fg">
            Top Selling Products & Margins
          </h3>
          <p className="mt-1 type-small text-fg-muted">
            Highest grossing garments, volume sold, and estimated gross margin percentage.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left type-admin">
            <thead className="border-b border-line bg-page/50 text-fg-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Garment Title</th>
                <th className="px-6 py-3 text-right font-medium">Units Sold</th>
                <th className="px-6 py-3 text-right font-medium">Gross Revenue</th>
                <th className="px-6 py-3 text-right font-medium">Gross Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-fg-muted">
                    No garment sales recorded in this period.
                  </td>
                </tr>
              ) : (
                data.topProducts.map((p) => (
                  <tr key={p.productId} className="transition-colors hover:bg-sunken/50">
                    <td className="px-6 py-4 font-medium text-fg">{p.title}</td>
                    <td className="px-6 py-4 text-right font-mono text-fg">{p.unitsSold}</td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-fg">
                      {p.revenueFormatted}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-accent-text">
                      {p.grossMarginPercent}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Module 15.7: Verification Performance & Staff Operations Scoreboard */}
      <section className="space-y-6 rounded-xs border border-line bg-raised p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="type-eyebrow text-accent-text">MODULE 15.7</span>
              <Badge tone="outline">Operations & SLA</Badge>
            </div>
            <h3 className="mt-1 type-h3 font-sans font-medium text-fg">
              Verification Performance & Staff Scoreboard
            </h3>
            <p className="mt-1 type-small text-fg-muted">
              Contact attempt metrics, verification channels, customer response rates, and staff
              velocity.
            </p>
          </div>
          <div className="flex items-center gap-3 type-caption font-mono">
            <div className="rounded-xs border border-line bg-page px-3 py-2 text-center">
              <p className="text-fg-muted">Total Attempts</p>
              <p className="mt-0.5 text-lg font-medium text-fg">
                {data.verification.totalAttempts}
              </p>
            </div>
            <div className="rounded-xs border border-line bg-page px-3 py-2 text-center">
              <p className="text-fg-muted">Orders Verified</p>
              <p className="mt-0.5 text-lg font-medium text-fg">
                {data.verification.ordersVerified}
              </p>
            </div>
          </div>
        </div>

        {/* Outcome Breakdown & Channels */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Outcome Breakdown */}
          <div className="space-y-3 rounded-xs border border-line bg-page p-5">
            <h4 className="type-small font-medium text-fg">Verification Call Outcomes</h4>
            <div className="space-y-2.5">
              {data.verification.outcomeBreakdown.length === 0 ? (
                <p className="type-caption text-fg-muted">No attempt outcomes logged.</p>
              ) : (
                data.verification.outcomeBreakdown.map((out) => (
                  <div key={out.outcome} className="flex items-center justify-between type-caption">
                    <span className="text-fg">{out.label}</span>
                    <span className="font-mono text-fg-muted">
                      {out.count} ({out.percentage}%)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cancellation Reasons Breakdown */}
          <div className="space-y-3 rounded-xs border border-line bg-page p-5">
            <h4 className="type-small font-medium text-fg">Order Cancellation Reasons</h4>
            <div className="space-y-2.5">
              {data.verification.cancelReasonBreakdown.length === 0 ? (
                <p className="type-caption text-fg-muted">No cancellations in this period.</p>
              ) : (
                data.verification.cancelReasonBreakdown.map((cr) => (
                  <div key={cr.reason} className="flex items-center justify-between type-caption">
                    <span className="max-w-xs truncate text-fg">{cr.reason}</span>
                    <span className="font-mono text-danger-text">
                      {cr.count} ({cr.percentage}%)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Staff Verification Scoreboard */}
        <div className="overflow-hidden rounded-xs border border-line">
          <div className="border-b border-line bg-page/70 p-4">
            <h4 className="type-small font-medium text-fg">
              Staff Member Velocity & SLA Compliance
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left type-admin">
              <thead className="border-b border-line bg-page/30 text-fg-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Staff Member</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 text-right font-medium">Attempts</th>
                  <th className="px-5 py-3 text-right font-medium">Confirmed</th>
                  <th className="px-5 py-3 text-right font-medium">Cancelled</th>
                  <th className="px-5 py-3 text-right font-medium">Median Time</th>
                  <th className="px-5 py-3 text-right font-medium">SLA Met (&lt; 2h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.verification.staffScoreboard.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-fg-muted">
                      No staff verification records in this period.
                    </td>
                  </tr>
                ) : (
                  data.verification.staffScoreboard.map((staff) => (
                    <tr key={staff.staffId} className="transition-colors hover:bg-sunken/40">
                      <td className="px-5 py-3 font-medium text-fg">{staff.staffName}</td>
                      <td className="px-5 py-3">
                        <Badge tone="outline" className="type-caption">
                          {staff.role.replaceAll('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-fg">
                        {staff.totalAttempts}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-fg">
                        {staff.ordersConfirmed}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-danger-text">
                        {staff.ordersCancelled}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-fg">
                        {staff.medianMinutesToVerify} min
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-accent-text">
                        {staff.slaMetPercent}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
