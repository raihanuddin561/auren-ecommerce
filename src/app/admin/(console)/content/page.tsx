import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/page-header';
import { requireStaffWith } from '@/lib/staff';
import { getPagesForAdmin } from '@/modules/content/queries';
import { PagesTable } from '@/components/admin/content/pages-table';

export const metadata: Metadata = {
  title: 'Content & Landing Pages | Admin Console',
};

export default async function AdminContentPage() {
  await requireStaffWith('content.manage');
  const { items, totalCount } = await getPagesForAdmin({ limit: 100 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content & Landing Pages"
        description="Design and manage luxury editorial pages, lookbooks, and section blocks with draft preview."
      />

      <PagesTable pages={items} totalCount={totalCount} />
    </div>
  );
}
