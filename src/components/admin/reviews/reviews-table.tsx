'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { moderateReviewAction } from '@/modules/reviews/actions';
import type { ReviewItem, ReviewStatus } from '@/modules/reviews/types';
import { ReviewDetailModal } from './review-detail-modal';
import {
  Check,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReviewsTableProps {
  items: ReviewItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  currentStatus: ReviewStatus | 'all';
  currentRating?: number;
  searchQuery?: string;
}

export function ReviewsTable({
  items,
  totalCount,
  currentPage,
  totalPages,
  currentStatus,
  currentRating,
  searchQuery,
}: ReviewsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchQuery ?? '');
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [quickActingId, setQuickActingId] = useState<string | null>(null);

  const updateFilters = (newParams: Record<string, string | undefined>) => {
    startTransition(() => {
      const url = new URL(window.location.href);
      Object.entries(newParams).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== 'all') {
          url.searchParams.set(k, v);
        } else {
          url.searchParams.delete(k);
        }
      });
      url.searchParams.set('page', '1');
      router.push(url.pathname + url.search);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: search.trim() || undefined });
  };

  const handleQuickModerate = (reviewId: string, status: 'approved' | 'rejected') => {
    setQuickActingId(reviewId);
    startTransition(async () => {
      const res = await moderateReviewAction({ reviewId, status });
      setQuickActingId(null);
      if (res.ok) {
        toast.success(status === 'approved' ? 'Review approved for storefront' : 'Review rejected');
        router.refresh();
      } else {
        toast.error(res.error.message || 'Action failed');
      }
    });
  };

  const handleInspect = (review: ReviewItem) => {
    setSelectedReview(review);
    setModalOpen(true);
  };

  const statusTabs: Array<{ id: ReviewStatus | 'all'; label: string }> = [
    { id: 'all', label: 'All Reviews' },
    { id: 'pending', label: 'Pending Moderation' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="space-y-4">
      {/* Filters and Search Bar */}
      <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tab Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {statusTabs.map((tab) => {
            const isActive = currentStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateFilters({ status: tab.id })}
                className={`rounded-xs px-3 py-1.5 type-caption font-medium transition-colors ${
                  isActive
                    ? 'bg-ink text-ivory'
                    : 'bg-raised text-fg-muted hover:bg-page hover:text-fg'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Star filter */}
        <div className="flex items-center gap-2">
          <select
            value={currentRating?.toString() ?? ''}
            onChange={(e) => updateFilters({ rating: e.target.value || undefined })}
            className="h-9 rounded-xs border border-line bg-raised px-2.5 type-caption text-fg"
          >
            <option value="">All Star Ratings</option>
            <option value="5">5 Stars only</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Input
              type="text"
              placeholder="Search reviewer or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48 border-line bg-raised pr-8 text-xs text-fg sm:w-64"
            />
            <button
              type="submit"
              className="absolute right-2.5 text-fg-muted hover:text-fg"
              aria-label="Submit search"
            >
              <Search size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xs border border-line bg-page">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-raised/70 type-caption font-mono tracking-wider text-fg-muted uppercase">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Rating</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Review Excerpt</th>
              <th className="px-4 py-3 font-medium">Fit Verdict</th>
              <th className="px-4 py-3 font-medium">Photos</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-fg-muted">
                  <p className="type-body-sm font-medium">No reviews match the current criteria.</p>
                  <p className="mt-1 type-caption">
                    Try switching filters or clearing your search query.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((r) => {
                const isActing = quickActingId === r.id || isPending;
                return (
                  <tr key={r.id} className="transition-colors hover:bg-raised/40">
                    {/* Product */}
                    <td className="px-4 py-3 font-medium text-fg">
                      <div className="max-w-[160px] truncate">{r.productTitle || 'Product'}</div>
                      {r.productSlug && (
                        <Link
                          href={`/products/${r.productSlug}`}
                          target="_blank"
                          className="mt-0.5 inline-flex items-center gap-1 type-caption text-accent-text hover:underline"
                        >
                          <span>Storefront</span>
                          <ExternalLink size={10} />
                        </Link>
                      )}
                    </td>

                    {/* Rating */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-0.5 text-accent-text">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={
                              i < r.rating ? 'fill-gold text-accent-text' : 'text-stone-300'
                            }
                          />
                        ))}
                      </div>
                      <span className="type-caption font-mono text-fg-muted">{r.rating}.0</span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-fg">{r.authorName}</p>
                      {r.isVerified && (
                        <div className="mt-0.5 flex items-center gap-1 type-caption text-accent-text">
                          <ShieldCheck size={11} />
                          <span>Verified</span>
                        </div>
                      )}
                    </td>

                    {/* Review Excerpt */}
                    <td className="px-4 py-3">
                      <p className="max-w-[220px] truncate font-medium text-fg">{r.title}</p>
                      <p className="line-clamp-1 max-w-[220px] type-caption text-fg-muted">
                        {r.body}
                      </p>
                    </td>

                    {/* Fit Verdict */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge tone={r.fitFeedback === 'true_to_size' ? 'neutral' : 'warning'}>
                        {r.fitFeedback === 'true_to_size'
                          ? 'True to Size'
                          : r.fitFeedback === 'runs_small'
                            ? 'Runs Small'
                            : 'Runs Large'}
                      </Badge>
                      {r.sizePurchased && (
                        <span className="ml-1.5 type-caption font-mono text-fg-muted">
                          {r.sizePurchased}
                        </span>
                      )}
                    </td>

                    {/* Photos */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.media.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-accent-text">
                          <ImageIcon size={13} />
                          <span className="font-mono">{r.media.length}</span>
                        </span>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        tone={
                          r.status === 'approved'
                            ? 'success'
                            : r.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleQuickModerate(r.id, 'approved')}
                              disabled={isActing}
                              title="Approve immediately"
                              className="flex size-7 items-center justify-center rounded-xs border border-line bg-page text-success-text hover:bg-success/10"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickModerate(r.id, 'rejected')}
                              disabled={isActing}
                              title="Reject"
                              className="flex size-7 items-center justify-center rounded-xs border border-line bg-page text-danger hover:bg-danger/10"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleInspect(r)}
                          className="h-7 px-2 text-xs"
                        >
                          <Eye size={12} className="mr-1" />
                          <span>Inspect</span>
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

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line pt-3">
          <p className="type-caption text-fg-muted">
            Showing Page {currentPage} of {totalPages} ({totalCount} total reviews)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1 || isPending}
              onClick={() => updateFilters({ page: (currentPage - 1).toString() })}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages || isPending}
              onClick={() => updateFilters({ page: (currentPage + 1).toString() })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Detail Inspector Modal */}
      <ReviewDetailModal review={selectedReview} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
