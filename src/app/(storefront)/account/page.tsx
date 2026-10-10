import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin, Package, Sparkles } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { requireUser } from '@/lib/auth';
import { getCustomerDashboardData } from '@/modules/customer/queries';
import { OrdersList } from '@/components/storefront/account/orders-list';

export const metadata: Metadata = {
  title: 'Client Overview | AUREN',
};

export default async function AccountOverviewPage() {
  const user = await requireUser();
  const data = await getCustomerDashboardData(user.id);

  return (
    <div className="space-y-8">
      {/* Header Welcome Banner */}
      <div className="rounded-xs border border-line bg-raised p-6 md:p-8">
        <span className="type-eyebrow tracking-widest text-accent-text">THE HOUSE OF AUREN</span>
        <h1 className="type-display mt-2 font-display text-fg">Welcome, {user.name}</h1>
        <p className="mt-2 max-w-xl type-body text-fg-muted">
          Your private client suite allows you to oversee bespoke tailoring orders, manage verified
          delivery residences, and access dedicated concierge consultations.
        </p>

        {/* Stats Strip */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-line/60 pt-6 sm:grid-cols-3">
          <div>
            <span className="block type-eyebrow text-fg-muted">COMMISSIONS</span>
            <span className="mt-1 block type-h2 font-display text-fg">{data.ordersCount}</span>
            <span className="type-body-xs text-fg-muted">Total orders</span>
          </div>

          <div>
            <span className="block type-eyebrow text-fg-muted">DESTINATIONS</span>
            <span className="mt-1 block type-h2 font-display text-fg">{data.addressesCount}</span>
            <span className="type-body-xs text-fg-muted">Saved addresses</span>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="block type-eyebrow text-fg-muted">MEMBERSHIP</span>
            <span className="mt-1 block type-h3 font-display text-accent-text">Private Client</span>
            <span className="type-body-xs text-fg-muted">Privileged tier</span>
          </div>
        </div>
      </div>

      {/* Two Column Section: Default Address & Quick Privileges */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Default Destination */}
        <div className="flex flex-col justify-between rounded-xs border border-line bg-page p-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="type-eyebrow text-accent-text">PRIMARY DESTINATION</span>
              <Icon icon={MapPin} className="size-4 text-accent-text" />
            </div>

            {data.defaultAddress ? (
              <div className="mt-4">
                <h3 className="type-h3 font-display text-fg">{data.defaultAddress.fullName}</h3>
                <p className="mt-1 type-body-sm text-fg-muted">{data.defaultAddress.phone}</p>
                <p className="mt-2 type-body-sm text-fg-muted">
                  {data.defaultAddress.line1}
                  {data.defaultAddress.area ? `, ${data.defaultAddress.area}` : ''}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="type-body-sm text-fg-muted">
                  No default delivery destination configured.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-line/60 pt-4">
            <Link
              href="/account/addresses"
              className="type-body-xs inline-flex items-center gap-1.5 font-medium text-accent-text underline underline-offset-4 hover:text-accent-text/80"
            >
              <span>{data.defaultAddress ? 'Manage Addresses' : 'Add Delivery Address'}</span>
              <Icon icon={ArrowRight} className="size-3" />
            </Link>
          </div>
        </div>

        {/* Private Atelier Privileges */}
        <div className="flex flex-col justify-between rounded-xs border border-line bg-page p-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="type-eyebrow text-accent-text">CLIENT PRIVILEGES</span>
              <Icon icon={Sparkles} className="size-4 text-accent-text" />
            </div>

            <h3 className="mt-4 type-h3 font-display text-fg">Complimentary Services</h3>
            <ul className="type-body-xs mt-2 space-y-2 text-fg-muted">
              <li>• 7-Day Doorstep Size Exchange across Dhaka & Nationwide</li>
              <li>• Private Fitting Appointments at our Dhaka Studio</li>
              <li>• Seasonal Lookbook Preview & Priority Allocations</li>
            </ul>
          </div>

          <div className="mt-6 border-t border-line/60 pt-4">
            <Link
              href="/contact"
              className="type-body-xs inline-flex items-center gap-1.5 font-medium text-accent-text underline underline-offset-4 hover:text-accent-text/80"
            >
              <span>Connect with Atelier Concierge</span>
              <Icon icon={ArrowRight} className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Icon icon={Package} className="size-5 text-accent-text" />
            <h2 className="type-h3 font-display text-fg">Recent Commissions</h2>
          </div>
          {data.ordersCount > 3 && (
            <Link
              href="/account/orders"
              className="type-body-xs text-accent-text underline underline-offset-4 hover:text-accent-text/80"
            >
              View all ({data.ordersCount})
            </Link>
          )}
        </div>

        <OrdersList orders={data.recentOrders} />
      </div>
    </div>
  );
}
