'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deletePageAction } from '@/modules/content/actions';
import type { PageListItem, PageStatus } from '@/modules/content/types';
import { CreatePageDialog } from './create-page-dialog';
import { ExternalLink, Edit3, Trash2, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface PagesTableProps {
  pages: PageListItem[];
  totalCount: number;
}

export function PagesTable({ pages, totalCount }: PagesTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredPages = pages.filter((p) => {
    const matchesSearch =
      search === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" and all its sections?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deletePageAction(id);
      if (!res.ok) {
        toast.error(res.error.message ?? 'Failed to delete page');
        return;
      }
      toast.success('Page deleted');
      router.refresh();
    } catch {
      toast.error('Unexpected error deleting page');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusTone = (status: PageStatus) => {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'neutral';
      case 'scheduled':
        return 'gold';
      case 'archived':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="bg-canvas flex flex-col items-stretch justify-between gap-3 rounded-sm border border-line p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="text-stone absolute top-2.5 left-2.5 h-3.5 w-3.5" />
            <Input
              placeholder="Search by title or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface h-9 border-line pl-8 text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface h-9 rounded-sm border border-line px-3 text-xs text-ink focus:ring-1 focus:ring-gold focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>

          <span className="text-stone hidden text-xs md:inline">
            Showing <strong className="text-ink">{filteredPages.length}</strong> of {totalCount}{' '}
            pages
          </span>
        </div>

        <div>
          <CreatePageDialog />
        </div>
      </div>

      {/* Pages Table */}
      <div className="bg-canvas overflow-hidden rounded-sm border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface/50 text-stone border-b border-line text-left">
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">
                  Page Title & Slug
                </th>
                <th className="w-28 px-4 py-2.5 font-medium tracking-wider uppercase">Status</th>
                <th className="w-28 px-4 py-2.5 font-medium tracking-wider uppercase">Sections</th>
                <th className="w-36 px-4 py-2.5 font-medium tracking-wider uppercase">
                  Last Updated
                </th>
                <th className="w-28 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-stone py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="text-stone/60 h-6 w-6" />
                      <p className="text-sm">No landing pages match your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-ink">
                        <Link
                          href={`/admin/content/${page.id}`}
                          className="transition-colors hover:text-gold"
                        >
                          {page.title}
                        </Link>
                      </div>
                      <div className="text-stone mt-0.5 flex items-center gap-1.5 font-mono text-xs">
                        <span>/pages/{page.slug}</span>
                        {page.status === 'published' && (
                          <Link
                            href={`/pages/${page.slug}`}
                            target="_blank"
                            className="text-gold hover:text-gold/80"
                            title="View live page"
                          >
                            <ExternalLink className="inline h-3 w-3" />
                          </Link>
                        )}
                      </div>
                      {page.description && (
                        <p className="text-stone mt-0.5 line-clamp-1 max-w-md text-xs">
                          {page.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      <Badge tone={getStatusTone(page.status)}>{page.status}</Badge>
                    </td>
                    <td className="text-stone px-4 py-3">
                      <span className="font-mono font-medium text-ink">{page.sectionsCount}</span>{' '}
                      blocks
                    </td>
                    <td className="text-stone px-4 py-3 font-mono text-xs">
                      {new Date(page.updatedAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="text-stone h-7 w-7 p-0 hover:text-ink"
                          title="Edit page sections"
                        >
                          <Link href={`/admin/content/${page.id}`}>
                            <Edit3 className="h-3.5 w-3.5" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === page.id}
                          onClick={() => handleDelete(page.id, page.title)}
                          className="text-stone h-7 w-7 p-0 hover:text-oxblood"
                          title="Delete page"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
