import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { CreateStaffDialog } from '@/components/admin/settings/staff/create-staff-dialog';
import { StaffTable } from '@/components/admin/settings/staff/staff-table';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { getStaffDirectoryForAdmin } from '@/modules/staff/queries';

export const metadata: Metadata = {
  title: 'Staff Management | AUREN Admin',
};

export default async function StaffManagementPage() {
  const staff = await requireStaff();
  assertPermission(staff, 'staff.manage');

  const staffList = await getStaffDirectoryForAdmin();

  return (
    <>
      <PageHeader
        title="Staff & Permissions"
        description="Provision team member accounts, assign operational roles, and enforce security policies."
        breadcrumb={[
          { label: 'Settings', href: '/admin/settings' },
          { label: 'Staff & Permissions' },
        ]}
        actions={<CreateStaffDialog />}
      />

      <div className="flex flex-col gap-6">
        <StaffTable staffList={staffList} currentStaffId={staff.id} />
      </div>
    </>
  );
}
