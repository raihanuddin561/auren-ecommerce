import type { Metadata } from 'next';
import { OrderRulesForm } from '@/components/admin/settings/order-rules-form';
import { PackagingManager } from '@/components/admin/settings/packaging-manager';
import { PageHeader } from '@/components/admin/page-header';
import { toDecimalString, money } from '@/lib/money';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { getReturnSettings, getVerificationSettings } from '@/modules/settings/queries';
import { getPackagingProfiles } from '@/modules/shipping/queries';

export const metadata: Metadata = { title: 'Orders and fulfilment' };

export default async function OrderSettingsPage() {
  const staff = await requireStaffWith('shipping.manage');
  const canRules = hasPermission(staff, 'settings.manage');
  const [verification, returns, profiles] = await Promise.all([
    getVerificationSettings(),
    getReturnSettings(),
    getPackagingProfiles(),
  ]);
  return (
    <>
      <PageHeader
        title="Orders and fulfilment"
        description="Packaging costs, verification rules and the return window. Changes are recorded in the audit log."
        breadcrumb={[
          { label: 'Settings', href: '/admin/settings' },
          { label: 'Orders and fulfilment' },
        ]}
      />
      <div className="flex max-w-4xl flex-col gap-6">
        <PackagingManager
          profiles={profiles.map((profile) => ({
            id: profile.id,
            name: profile.name,
            cost: toDecimalString(money(profile.costMinor, profile.currency)),
            isDefault: profile.isDefault,
            active: profile.active,
          }))}
        />
        {canRules ? (
          <OrderRulesForm verification={verification} returns={returns} />
        ) : (
          <p className="type-admin text-fg-muted">
            Verification rules and the return window are changed by the owner or an admin.
          </p>
        )}
      </div>
    </>
  );
}
