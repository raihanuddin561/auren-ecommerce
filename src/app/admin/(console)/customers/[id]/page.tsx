import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CustomerBlockDialog } from '@/components/admin/customers/customer-block-dialog';
import { CustomerStatusBadge } from '@/components/admin/customers/customer-status-badge';
import { KpiCard } from '@/components/admin/kpi-card';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { format, money } from '@/lib/money';
import { assertPermission, hasPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { getCustomerDetailForAdmin } from '@/modules/customer/queries';

export const metadata: Metadata = {
  title: 'Customer Profile — Auren Console',
};

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dhaka',
});

const dateOnly = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'Asia/Dhaka',
});

const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const staff = await requireStaff();
  assertPermission(staff, 'customers.read');

  const { id } = await params;
  const customer = await getCustomerDetailForAdmin(id);

  if (!customer) {
    notFound();
  }

  const canWrite = hasPermission(staff, 'customers.write');

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumb={[{ label: 'Customers', href: '/admin/customers' }, { label: customer.name }]}
        title={customer.name}
        description={`Client profile registered on ${dateOnly.format(new Date(customer.createdAt))}`}
        actions={
          <CustomerBlockDialog
            customerId={customer.id}
            customerName={customer.name}
            isBlocked={customer.banned}
            canWrite={canWrite}
          />
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Lifetime value (LTV)"
          value={format(money(customer.metrics.ltvMinor, customer.metrics.currency), {
            trimZeroFraction: true,
          })}
          footnote={`${customer.metrics.validOrdersCount} fulfilled/active orders`}
        />
        <KpiCard
          label="Average order value (AOV)"
          value={format(money(customer.metrics.aovMinor, customer.metrics.currency), {
            trimZeroFraction: true,
          })}
          footnote="Net per valid order"
        />
        <KpiCard
          label="Total orders"
          value={customer.metrics.ordersCount}
          footnote={
            customer.metrics.lastOrderAt
              ? `Last on ${dateOnly.format(new Date(customer.metrics.lastOrderAt))}`
              : 'No orders yet'
          }
        />
        <KpiCard
          label="Saved destinations"
          value={customer.addresses.length}
          footnote="Delivery addresses on file"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Account Details Side Card */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <section className="border border-line bg-raised p-5">
            <h2 className="mb-4 type-eyebrow text-fg-muted">Client Details</h2>
            <dl className="divide-y divide-line type-admin">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-muted">Status</dt>
                <dd>
                  <CustomerStatusBadge banned={customer.banned} />
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-muted">Email</dt>
                <dd className="type-small font-mono text-fg">{customer.email}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-muted">Email verified</dt>
                <dd>
                  {customer.emailVerified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="neutral">Unverified</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-muted">Phone</dt>
                <dd className="text-fg tabular-nums">{customer.phone ?? 'None'}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-muted">Phone verified</dt>
                <dd>
                  {customer.phoneVerified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="neutral">Unverified</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-muted">Two-factor (2FA)</dt>
                <dd>
                  {customer.twoFactorEnabled ? (
                    <Badge tone="success">Active</Badge>
                  ) : (
                    <Badge tone="neutral">Off</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-muted">Member since</dt>
                <dd className="text-fg">{dateOnly.format(new Date(customer.createdAt))}</dd>
              </div>
            </dl>
          </section>

          {/* Saved Destinations */}
          <section className="border border-line bg-raised p-5">
            <h2 className="mb-4 type-eyebrow text-fg-muted">Delivery Addresses</h2>
            {customer.addresses.length === 0 ? (
              <p className="type-small text-fg-muted">No addresses saved on file.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {customer.addresses.map((addr) => (
                  <div key={addr.id} className="bg-subtle border border-line p-3 type-small">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-fg">{addr.label ?? 'Destination'}</span>
                      {addr.isDefault ? <Badge tone="gold">Default</Badge> : null}
                    </div>
                    <p className="text-fg">{addr.fullName}</p>
                    <p className="text-fg-muted tabular-nums">{addr.phone}</p>
                    <p className="mt-1 text-fg-muted">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ''}
                    </p>
                    <p className="text-fg-muted">
                      {[addr.area, addr.thanaName, addr.postalCode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Order History */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="border border-line bg-raised p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="type-eyebrow text-fg-muted">Order History</h2>
              <span className="type-small text-fg-muted">
                {customer.orders.length} orders total
              </span>
            </div>

            {customer.orders.length === 0 ? (
              <p className="py-8 text-center type-small text-fg-muted">
                This client has not placed any orders yet.
              </p>
            ) : (
              <div className="overflow-x-auto border border-line">
                <table className="w-full border-collapse text-left type-admin">
                  <thead>
                    <tr className="bg-subtle">
                      <th className={head}>Order #</th>
                      <th className={head}>Date</th>
                      <th className={head}>Status</th>
                      <th className={head}>Items</th>
                      <th className={`${head} text-right`}>Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {customer.orders.map((o) => (
                      <tr key={o.id} className="transition-auren-fast hover:bg-fg/2">
                        <td className={cell}>
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="font-mono font-medium text-fg hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td className={cell}>
                          <span className="type-small text-fg-muted">
                            {dateTime.format(new Date(o.createdAt))}
                          </span>
                        </td>
                        <td className={cell}>
                          <OrderStatusBadge status={o.status} />
                        </td>
                        <td className={cell}>
                          <span className="type-small text-fg-muted">
                            {o.items.length} {o.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </td>
                        <td className={`${cell} text-right`}>
                          <span className="font-medium text-fg tabular-nums">
                            {format(money(o.totalMinor, o.currency))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
