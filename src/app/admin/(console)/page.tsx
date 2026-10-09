import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ExternalLink, PackageCheck, PhoneCall, Truck, Users } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { KpiCard } from '@/components/admin/kpi-card';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { requireStaff } from '@/lib/staff';
import { getAdminDashboardOrderStats } from '@/modules/orders/queries';
import { getLowStockVariantCount } from '@/modules/inventory/queries';

export const metadata: Metadata = {
  title: 'Dashboard | AUREN Admin',
};

function formatOrderDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dhaka',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function AdminHomePage() {
  // Layout checks staff too; pages must still authenticate directly (tests/lint/admin-guards.test.ts).
  const staff = await requireStaff();

  const [orderStats, lowStockCount] = await Promise.all([
    getAdminDashboardOrderStats(),
    getLowStockVariantCount().catch(() => 0),
  ]);

  const firstName = staff.name.split(' ')[0] ?? 'Staff';
  const hasOrders = orderStats.totalOrdersCount > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${firstName}. Atelier overview and active operations.`}
        actions={
          <div className="flex items-center gap-3">
            <Badge tone="outline">{staff.role.replaceAll('_', ' ')}</Badge>
            <Button asChild variant="secondary" size="sm">
              <Link href="/" target="_blank" rel="noopener noreferrer">
                <span>View Store</span>
                <Icon icon={ExternalLink} size={14} className="ml-1.5" />
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Cards Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Pending verification"
          value={orderStats.pendingConfirmationsCount}
          state="ready"
          delta={
            orderStats.overdueVerificationCount > 0
              ? {
                  value: `${orderStats.overdueVerificationCount} overdue`,
                  direction: 'up',
                  tone: 'bad',
                  comparedTo: 'SLA 2h',
                }
              : orderStats.pendingConfirmationsCount > 0
                ? {
                    value: `${orderStats.pendingConfirmationsCount} in queue`,
                    direction: 'up',
                    tone: 'neutral',
                    comparedTo: 'needs call',
                  }
                : undefined
          }
          footnote={
            orderStats.pendingConfirmationsCount > 0
              ? 'Awaiting customer phone verification'
              : 'Verification queue is clear'
          }
        />

        <KpiCard
          label="To ship"
          value={orderStats.toShipCount}
          state="ready"
          delta={
            orderStats.toShipCount > 0
              ? {
                  value: `${orderStats.toShipCount} orders`,
                  direction: 'up',
                  tone: 'neutral',
                  comparedTo: 'ready',
                }
              : undefined
          }
          footnote={
            orderStats.toShipCount > 0
              ? 'Confirmed & preparing for courier handover'
              : 'All confirmed orders dispatched'
          }
        />

        <KpiCard
          label="Net sales"
          value={hasOrders ? orderStats.netSalesFormatted : ''}
          state={hasOrders ? 'ready' : 'empty'}
          stateMessage="Appears with the first confirmed orders."
          delta={
            orderStats.netSalesMinor > 0n
              ? {
                  value: `${orderStats.totalOrdersCount} orders`,
                  direction: 'up',
                  tone: 'good',
                  comparedTo: 'total placed',
                }
              : undefined
          }
          footnote={
            orderStats.deliveredCount > 0
              ? `${orderStats.deliveredCount} delivered (${orderStats.deliveredSalesFormatted})`
              : hasOrders
                ? `${orderStats.totalOrdersCount} store orders recorded`
                : undefined
          }
        />

        <KpiCard
          label="Average order value"
          value={hasOrders ? orderStats.aovFormatted : ''}
          state={hasOrders ? 'ready' : 'empty'}
          stateMessage="Calculated once orders are placed."
          footnote="Revenue per fulfilled order"
        />

        <KpiCard
          label="Low stock items"
          value={lowStockCount}
          state="ready"
          delta={
            lowStockCount > 0
              ? {
                  value: `${lowStockCount} items`,
                  direction: 'up',
                  tone: 'bad',
                  comparedTo: 'below buffer',
                }
              : undefined
          }
          footnote={
            lowStockCount > 0
              ? 'Variants requiring inventory reorder'
              : 'All variant levels healthy'
          }
        />

        <KpiCard
          label="RTO & Cancel rate"
          value={orderStats.rtoRateFormatted}
          state={hasOrders ? 'ready' : 'empty'}
          stateMessage="Tracked on first dispatches."
          delta={{
            value: `${orderStats.verificationCancelRateFormatted} cancel`,
            direction: 'flat',
            tone: 'neutral',
            comparedTo: 'all orders',
          }}
          footnote={`${orderStats.rtoCount} parcel(s) returned to origin`}
        />
      </div>

      {/* Operations Quick Links Hub */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/admin/orders/verification"
          className="group flex flex-col justify-between rounded-xs border border-line bg-page p-4 transition-colors hover:border-fg-muted"
        >
          <div className="flex items-center justify-between">
            <span className="type-eyebrow text-fg-muted">VERIFICATION</span>
            <Icon
              icon={PhoneCall}
              size={16}
              className="text-fg-muted group-hover:text-accent-text"
            />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="type-h3 font-display text-fg">
              {orderStats.pendingConfirmationsCount}
            </span>
            <span className="type-body-xs flex items-center gap-1 text-accent-text group-hover:underline">
              <span>Queue</span>
              <Icon icon={ArrowRight} size={12} />
            </span>
          </div>
        </Link>

        <Link
          href="/admin/orders"
          className="group flex flex-col justify-between rounded-xs border border-line bg-page p-4 transition-colors hover:border-fg-muted"
        >
          <div className="flex items-center justify-between">
            <span className="type-eyebrow text-fg-muted">FULFILMENT</span>
            <Icon icon={Truck} size={16} className="text-fg-muted group-hover:text-accent-text" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="type-h3 font-display text-fg">{orderStats.toShipCount}</span>
            <span className="type-body-xs flex items-center gap-1 text-accent-text group-hover:underline">
              <span>To Ship</span>
              <Icon icon={ArrowRight} size={12} />
            </span>
          </div>
        </Link>

        <Link
          href="/admin/inventory"
          className="group flex flex-col justify-between rounded-xs border border-line bg-page p-4 transition-colors hover:border-fg-muted"
        >
          <div className="flex items-center justify-between">
            <span className="type-eyebrow text-fg-muted">INVENTORY</span>
            <Icon
              icon={PackageCheck}
              size={16}
              className="text-fg-muted group-hover:text-accent-text"
            />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="type-h3 font-display text-fg">{lowStockCount}</span>
            <span className="type-body-xs flex items-center gap-1 text-accent-text group-hover:underline">
              <span>Stock</span>
              <Icon icon={ArrowRight} size={12} />
            </span>
          </div>
        </Link>

        <Link
          href="/admin/customers"
          className="group flex flex-col justify-between rounded-xs border border-line bg-page p-4 transition-colors hover:border-fg-muted"
        >
          <div className="flex items-center justify-between">
            <span className="type-eyebrow text-fg-muted">CLIENTS</span>
            <Icon icon={Users} size={16} className="text-fg-muted group-hover:text-accent-text" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="type-h3 font-display text-fg">{orderStats.totalOrdersCount}</span>
            <span className="type-body-xs flex items-center gap-1 text-accent-text group-hover:underline">
              <span>Accounts</span>
              <Icon icon={ArrowRight} size={12} />
            </span>
          </div>
        </Link>
      </div>

      {/* Orders Attention Queue (if any order needs staff call or ship) */}
      {orderStats.attentionOrders.length > 0 && (
        <section aria-label="Operations Attention Queue" className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="type-h3 font-display text-fg">Operations Attention Queue</h2>
              <p className="type-body-xs text-fg-muted">
                Orders awaiting verification or fulfillment dispatch, oldest first.
              </p>
            </div>
            <Link
              href="/admin/orders/verification"
              className="type-body-xs inline-flex items-center gap-1 text-accent-text underline underline-offset-4 hover:text-accent-text/80"
            >
              <span>Verification Workspace</span>
              <Icon icon={ArrowRight} size={12} />
            </Link>
          </div>

          <div className="divide-y divide-line border border-line bg-page">
            {orderStats.attentionOrders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-raised sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-sm font-medium text-fg hover:text-accent-text"
                    >
                      {order.orderNumber}
                    </Link>
                    <OrderStatusBadge status={order.status} />
                    <span className="type-body-xs text-fg-muted">
                      {formatOrderDate(order.placedAt)}
                    </span>
                  </div>
                  <div className="type-body-xs flex flex-wrap items-center gap-2 text-fg-muted">
                    <span className="font-medium text-fg">{order.customerName}</span>
                    <span>•</span>
                    <span>{order.phone}</span>
                    <span>•</span>
                    <span className="text-fg-muted">{order.itemsSummary}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="type-body-sm font-medium text-fg tabular-nums">
                    {order.totalFormatted}
                  </span>
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      href={
                        order.status === 'placed' || order.status === 'under_verification'
                          ? '/admin/orders/verification'
                          : `/admin/orders/${order.id}`
                      }
                    >
                      <span>
                        {order.status === 'placed' || order.status === 'under_verification'
                          ? 'Verify'
                          : 'Manage'}
                      </span>
                      <Icon icon={ArrowRight} size={12} className="ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Orders Stream */}
      {hasOrders ? (
        <section aria-label="Recent Orders Stream" className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <h2 className="type-h3 font-display text-fg">Recent Commissions</h2>
              <p className="type-body-xs text-fg-muted">
                Latest orders received and fulfilled across the atelier.
              </p>
            </div>
            <Link
              href="/admin/orders"
              className="type-body-xs inline-flex items-center gap-1 text-accent-text underline underline-offset-4 hover:text-accent-text/80"
            >
              <span>View All ({orderStats.totalOrdersCount})</span>
              <Icon icon={ArrowRight} size={12} />
            </Link>
          </div>

          <div className="overflow-x-auto border border-line bg-page">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line type-eyebrow text-fg-muted">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Pieces</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orderStats.recentOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-raised">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-sm font-medium text-fg hover:text-accent-text"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="type-body-xs font-medium text-fg">{order.customerName}</div>
                      <div className="type-body-xs text-fg-muted">{order.phone}</div>
                    </td>
                    <td className="type-body-xs max-w-[200px] truncate px-4 py-3 text-fg-muted">
                      {order.itemsSummary}
                    </td>
                    <td className="type-body-xs px-4 py-3 whitespace-nowrap text-fg-muted">
                      {formatOrderDate(order.placedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={order.paymentStatus === 'paid' ? 'success' : 'neutral'}>
                        {order.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="type-body-xs px-4 py-3 text-right font-medium whitespace-nowrap text-fg tabular-nums">
                      {order.totalFormatted}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="type-body-xs inline-flex items-center gap-1 font-medium text-accent-text hover:underline"
                      >
                        <span>View</span>
                        <Icon icon={ArrowRight} size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState
          className="mt-8"
          title="Nothing needs your attention yet"
          description="Orders waiting for verification will appear here, oldest first, for staff to check and confirm."
        />
      )}
    </div>
  );
}
