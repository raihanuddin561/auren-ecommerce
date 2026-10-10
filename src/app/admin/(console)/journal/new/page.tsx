import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireStaff } from '@/lib/staff';
import { assertPermission } from '@/lib/permissions';
import { ArticleEditor } from '@/components/admin/journal/article-editor';

export const metadata: Metadata = {
  title: 'Compose Article | Auren Admin',
};

export default async function AdminNewArticlePage() {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/journal"
          className="inline-flex items-center gap-1.5 type-caption font-mono text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={13} />
          <span>Back to Articles</span>
        </Link>
      </div>

      <div>
        <h1 className="type-title-lg font-serif text-fg">Compose New Story</h1>
        <p className="type-caption text-fg-muted">
          Write an editorial essay with markdown formatting and attach featured garments.
        </p>
      </div>

      <ArticleEditor />
    </div>
  );
}
