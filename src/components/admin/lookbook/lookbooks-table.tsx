'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ExternalLink, Edit3, Trash2, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteLookbookAction } from '@/modules/lookbook/actions';
import type { LookbookListItem } from '@/modules/lookbook/types';

interface LookbooksTableProps {
  initialLookbooks: LookbookListItem[];
}

export function LookbooksTable({ initialLookbooks }: LookbooksTableProps) {
  const router = useRouter();
  const [items, setItems] = useState<LookbookListItem[]>(initialLookbooks);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = items.filter((lb) => {
    if (statusFilter !== 'all' && lb.status !== statusFilter) return false;
    return true;
  });

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete lookbook "${title}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteLookbookAction(id);
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        router.refresh();
      } else {
        alert(res.error.message || 'Failed to delete lookbook');
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
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xs border border-line bg-page">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-raised/70 type-caption font-mono tracking-wider text-fg-muted uppercase">
              <th className="px-4 py-3 font-medium">Lookbook</th>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">Frames</th>
              <th className="px-4 py-3 font-medium">Hotspots</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-fg-muted">
                  <p className="type-body-sm font-medium">No lookbooks match the current view.</p>
                  <p className="mt-1 type-caption">
                    Create a new lookbook to begin assembling seasonal curations.
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((lb) => {
                const isDeleting = deletingId === lb.id;
                return (
                  <tr key={lb.id} className="transition-colors hover:bg-raised/40">
                    {/* Lookbook Cover & Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-xs border border-line bg-raised">
                          <Image
                            src={lb.heroImage}
                            alt={lb.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/lookbooks/${lb.id}`}
                            className="block max-w-xs truncate font-medium text-fg hover:text-accent-text"
                          >
                            {lb.title}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="type-caption font-mono text-fg-muted">/{lb.slug}</span>
                            {lb.status === 'published' && (
                              <Link
                                href={`/lookbook/${lb.slug}`}
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

                    {/* Season */}
                    <td className="px-4 py-3 type-caption font-mono text-fg">
                      <span className="rounded-xs bg-raised px-2 py-0.5">{lb.season}</span>
                    </td>

                    {/* Frames */}
                    <td className="px-4 py-3 type-caption font-mono text-fg">
                      <span className="inline-flex items-center gap-1">
                        <Layers size={12} className="text-fg-muted" />
                        <span>{lb.slideCount}</span>
                      </span>
                    </td>

                    {/* Hotspots */}
                    <td className="px-4 py-3 type-caption font-mono text-fg">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles size={12} className="text-accent-text" />
                        <span>{lb.hotspotCount}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-xs px-2 py-0.5 type-caption font-mono uppercase ${
                          lb.status === 'published'
                            ? 'border border-accent-text/30 bg-accent-text/10 text-accent-text'
                            : 'border border-line bg-raised text-fg-muted'
                        }`}
                      >
                        {lb.status}
                      </span>
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3 type-caption font-mono whitespace-nowrap text-fg-muted">
                      {new Date(lb.updatedAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="secondary" size="sm" asChild className="h-7 px-2 text-xs">
                          <Link href={`/admin/lookbooks/${lb.id}`}>
                            <Edit3 size={12} className="mr-1" />
                            <span>Studio</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(lb.id, lb.title)}
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
