import type { Metadata } from 'next';
import { requireStaff } from '@/lib/staff';
import { assertPermission } from '@/lib/permissions';
import { getAdminLookbooksQuery } from '@/modules/lookbook/queries';
import { LookbooksTable } from '@/components/admin/lookbook/lookbooks-table';
import { CreateLookbookDialog } from '@/components/admin/lookbook/create-lookbook-dialog';

export const metadata: Metadata = {
  title: 'Lookbooks | Auren Admin',
};

export default async function AdminLookbooksPage() {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');

  const lookbooks = await getAdminLookbooksQuery();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="type-title-lg font-serif text-fg">Lookbooks &amp; Hotspots</h1>
          <p className="type-caption text-fg-muted">
            Curate visual editorial campaigns, manage frames, and map interactive shoppable garment
            pins.
          </p>
        </div>
        <CreateLookbookDialog />
      </div>

      <LookbooksTable initialLookbooks={lookbooks} />
    </div>
  );
}
