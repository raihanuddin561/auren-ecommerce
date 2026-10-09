import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { HealthDashboard } from '@/components/admin/health/health-dashboard';
import { requireStaffWith } from '@/lib/staff';
import { getSystemHealthForAdmin } from '@/modules/settings/queries';

export const metadata: Metadata = { title: 'System Health | Settings' };

export default async function HealthSettingsPage() {
  await requireStaffWith('settings.manage');

  const healthData = await getSystemHealthForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="System Health"
        description="Live infrastructure diagnostics, database connection latency, outbox event pipeline, and external service statuses."
      />

      <HealthDashboard data={healthData} />
    </div>
  );
}
