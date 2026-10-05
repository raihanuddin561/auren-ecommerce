import type { Metadata } from 'next';
import { CheckoutSettingsForm } from '@/components/admin/settings/checkout-settings-form';
import { ZoneEditor } from '@/components/admin/settings/zone-editor';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { getCheckoutSettingsForAdmin } from '@/modules/settings/queries';
import { getDivisionsAndDistricts, getShippingConfigForAdmin } from '@/modules/shipping/queries';

export const metadata: Metadata = { title: 'Delivery and checkout' };

export default async function ShippingSettingsPage() {
  const staff = await requireStaffWith('settings.manage');
  const [zones, areas, checkout] = await Promise.all([
    getShippingConfigForAdmin(),
    getDivisionsAndDistricts(),
    getCheckoutSettingsForAdmin(),
  ]);
  const canWrite = hasPermission(staff, 'settings.manage');

  return (
    <>
      <PageHeader
        title="Delivery and checkout"
        description="Where you deliver, what it costs, how long it takes, and the limits that keep checkout safe. The checkout reads these on every order."
        breadcrumb={[
          { label: 'Settings', href: '/admin/settings' },
          { label: 'Delivery and checkout' },
        ]}
      />
      <div className="flex flex-col gap-10">
        <section aria-labelledby="zones-heading" className="flex flex-col gap-5">
          <h2 id="zones-heading" className="type-h3 text-fg">
            Delivery zones
          </h2>
          {zones.length === 0 ? (
            <EmptyState
              title="No delivery zones yet"
              description="Run the reference data seed (pnpm db:seed:reference) to install the delivery areas and the two default zones."
            />
          ) : (
            zones.map((zone) => (
              <ZoneEditor key={zone.id} zone={zone} areas={areas} canWrite={canWrite} />
            ))
          )}
        </section>
        <section aria-labelledby="checkout-heading" className="flex flex-col gap-5">
          <h2 id="checkout-heading" className="type-h3 text-fg">
            Payment and protection
          </h2>
          <CheckoutSettingsForm settings={checkout} />
        </section>
      </div>
    </>
  );
}
