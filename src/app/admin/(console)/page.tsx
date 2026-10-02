import { PageHeader } from '@/components/admin/page-header';
import { KpiCard } from '@/components/admin/kpi-card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { requireStaff } from '@/lib/staff';

export default async function AdminHomePage() {
  // The layout checks too, but pages never rely on it: layouts do not re-run on client navigation.
  const staff = await requireStaff();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${staff.name.split(' ')[0]}.`}
        actions={<Badge tone="outline">{staff.role.replaceAll('_', ' ')}</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pending confirmations"
          value=""
          state="empty"
          stateMessage="Every order is checked by a person before it is confirmed."
        />
        <KpiCard
          label="To ship"
          value=""
          state="empty"
          stateMessage="Appears with the first orders."
        />
        <KpiCard
          label="Low stock"
          value=""
          state="empty"
          stateMessage="Appears once stock is tracked."
        />
        <KpiCard
          label="Net sales"
          value=""
          state="empty"
          stateMessage="Appears with the first orders."
        />
      </div>
      <EmptyState
        className="mt-8"
        title="Nothing needs your attention yet"
        description="Orders waiting for verification will appear here, oldest first, for a person to check and confirm."
      />
    </>
  );
}
