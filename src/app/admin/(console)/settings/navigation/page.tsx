import type { Metadata } from 'next';
import { NavigationEditor } from '@/components/admin/settings/navigation-editor';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';
import { getNavigationForAdmin } from '@/modules/settings/queries';

export const metadata: Metadata = { title: 'Navigation & Menu Bar' };

export default async function NavigationSettingsPage() {
  await requireStaffWith('settings.manage');
  const settings = await getNavigationForAdmin();

  return (
    <>
      <PageHeader
        title="Navigation & Menu Bar"
        description="Configure storefront primary navigation links, multi-column mega-menu categories, and promotional highlight tiles. Changes update the storefront immediately."
        breadcrumb={[
          { label: 'Settings', href: '/admin/settings' },
          { label: 'Navigation & Menu Bar' },
        ]}
      />
      <NavigationEditor initialSettings={settings} />
    </>
  );
}
