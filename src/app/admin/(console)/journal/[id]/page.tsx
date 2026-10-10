import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireStaff } from '@/lib/staff';
import { assertPermission } from '@/lib/permissions';
import { getAdminArticleDetailQuery } from '@/modules/journal/queries';
import { ArticleEditor } from '@/components/admin/journal/article-editor';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Edit Article | Auren Admin',
};

export default async function AdminEditArticlePage({ params }: PageProps) {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');

  const { id } = await params;
  const article = await getAdminArticleDetailQuery(id);

  if (!article) {
    notFound();
  }

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
        <h1 className="type-title-lg font-serif text-fg">{article.title}</h1>
        <p className="type-caption text-fg-muted">
          Category: {article.category} • Author: {article.authorName} • Status: {article.status}
        </p>
      </div>

      <ArticleEditor initialArticle={article} />
    </div>
  );
}
