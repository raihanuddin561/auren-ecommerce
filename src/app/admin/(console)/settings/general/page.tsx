import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { GeneralSettingsForm } from '@/components/admin/settings/general-settings-form';
import { requireStaffWith } from '@/lib/staff';
import { getStoreGeneralSettingsForAdmin } from '@/modules/settings/queries';

export const metadata: Metadata = {
  title: 'Store Settings | AUREN Admin',
};

export default async function GeneralSettingsPage() {
  await requireStaffWith('settings.manage');
  const settings = await getStoreGeneralSettingsForAdmin();

  return (
    <>
      <PageHeader
        title="Store Information"
        description="Brand identity, concierge channels, studio address, tax settings, and social links."
        breadcrumb={[
          { label: 'Settings', href: '/admin/settings' },
          { label: 'Store Information' },
        ]}
      />
      <div className="max-w-4xl">
        <GeneralSettingsForm initial={settings} />
      </div>
    </>
  );
}
