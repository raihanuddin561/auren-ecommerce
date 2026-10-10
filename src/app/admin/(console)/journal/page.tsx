import type { Metadata } from 'next';
import { requireStaff } from '@/lib/staff';
import { assertPermission } from '@/lib/permissions';
import { getAdminArticlesQuery } from '@/modules/journal/queries';
import { ArticlesTable } from '@/components/admin/journal/articles-table';

export const metadata: Metadata = {
  title: 'Journal Articles | Auren Admin',
};

export default async function AdminJournalPage() {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');

  const { items: articles } = await getAdminArticlesQuery({ pageSize: 50 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="type-title-lg font-serif text-fg">Journal &amp; Editorial Stories</h1>
          <p className="type-caption text-fg-muted">
            Compose and publish essays on noble fibers, tailoring architecture, and sartorial
            culture.
          </p>
        </div>
      </div>

      <ArticlesTable initialArticles={articles} />
    </div>
  );
}
