'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ExternalLink, Edit3, Trash2, Clock, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteArticleAction } from '@/modules/journal/actions';
import type { ArticleListItem } from '@/modules/journal/types';

interface ArticlesTableProps {
  initialArticles: ArticleListItem[];
}

export function ArticlesTable({ initialArticles }: ArticlesTableProps) {
  const router = useRouter();
  const [items, setItems] = useState<ArticleListItem[]>(initialArticles);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = items.filter((art) => {
    if (statusFilter !== 'all' && art.status !== statusFilter) return false;
    return true;
  });

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete article "${title}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteArticleAction(id);
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        router.refresh();
      } else {
        alert(res.error.message || 'Failed to delete article');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          {(['all', 'published', 'draft'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`rounded-xs px-3 py-1 type-caption font-mono uppercase transition-colors ${
                statusFilter === tab
                  ? 'bg-ink font-medium text-ivory'
                  : 'bg-raised/60 text-fg-muted hover:text-fg'
              }`}
            >
              {tab} ({tab === 'all' ? items.length : items.filter((i) => i.status === tab).length})
            </button>
          ))}
        </div>

        <Button size="sm" asChild>
          <Link href="/admin/journal/new">
            <Plus size={14} className="mr-1.5" />
            <span>New Article</span>
          </Link>
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xs border border-line bg-page">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-raised/70 type-caption font-mono tracking-wider text-fg-muted uppercase">
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Author</th>
              <th className="px-4 py-3 font-medium">Reading Time</th>
              <th className="px-4 py-3 font-medium">Garments Linked</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-fg-muted">
                  <p className="type-body-sm font-medium">No articles match the current view.</p>
                  <p className="mt-1 type-caption">
                    Compose a new journal entry to share craftsmanship and style stories.
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((art) => {
                const isDeleting = deletingId === art.id;
                return (
                  <tr key={art.id} className="transition-colors hover:bg-raised/40">
                    {/* Article Image & Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-xs border border-line bg-raised">
                          <Image
                            src={art.heroImage}
                            alt={art.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/journal/${art.id}`}
                            className="block max-w-xs truncate font-medium text-fg hover:text-accent-text"
                          >
                            {art.title}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="type-caption font-mono text-fg-muted">
                              /{art.slug}
                            </span>
                            {art.status === 'published' && (
                              <Link
                                href={`/journal/${art.slug}`}
                                target="_blank"
                                className="inline-flex items-center gap-0.5 type-caption font-mono text-accent-text hover:underline"
                              >
                                <span>Preview</span>
                                <ExternalLink size={10} />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 type-caption font-mono text-fg">
                      <span className="rounded-xs bg-raised px-2 py-0.5">{art.category}</span>
                    </td>

                    {/* Author */}
                    <td className="px-4 py-3 font-medium text-fg">{art.authorName}</td>

                    {/* Reading Time */}
                    <td className="px-4 py-3 type-caption font-mono text-fg-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} />
                        <span>{art.readTimeMinutes} min</span>
                      </span>
                    </td>

                    {/* Linked Garments */}
                    <td className="px-4 py-3 type-caption font-mono text-fg">
                      <span className="inline-flex items-center gap-1">
                        <Tag size={11} className="text-accent-text" />
                        <span>{art.featuredProductCount} pieces</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-xs px-2 py-0.5 type-caption font-mono uppercase ${
                          art.status === 'published'
                            ? 'border border-accent-text/30 bg-accent-text/10 text-accent-text'
                            : 'border border-line bg-raised text-fg-muted'
                        }`}
                      >
                        {art.status}
                      </span>
                    </td>

                    {/* Published At */}
                    <td className="px-4 py-3 type-caption font-mono whitespace-nowrap text-fg-muted">
                      {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString() : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="secondary" size="sm" asChild className="h-7 px-2 text-xs">
                          <Link href={`/admin/journal/${art.id}`}>
                            <Edit3 size={12} className="mr-1" />
                            <span>Edit</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(art.id, art.title)}
                          disabled={isDeleting}
                          className="h-7 px-2 text-xs text-danger hover:bg-danger/10"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
