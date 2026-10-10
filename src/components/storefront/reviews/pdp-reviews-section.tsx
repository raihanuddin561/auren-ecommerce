'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { voteHelpfulReviewAction } from '@/modules/reviews/actions';
import type { ProductRatingStatsData, ReviewItem } from '@/modules/reviews/types';
import { WriteReviewModal } from './write-review-modal';
import { Camera, MessageSquare, PenSquare, ShieldCheck, Star, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';

interface PdpReviewsSectionProps {
  productId: string;
  productTitle: string;
  productSlug?: string;
  stats: ProductRatingStatsData;
  initialReviews: ReviewItem[];
}

export function PdpReviewsSection({
  productId,
  productTitle,
  productSlug: _productSlug,
  stats,
  initialReviews,
}: PdpReviewsSectionProps) {
  const [reviews] = useState<ReviewItem[]>(initialReviews);
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // Filter & sort states
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'recent' | 'rating_desc' | 'helpful'>('recent');

  // Helpful votes track map: reviewId -> count
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    initialReviews.forEach((r) => {
      map[r.id] = r.helpfulCount;
    });
    return map;
  });
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  const handleHelpfulClick = async (reviewId: string) => {
    if (votedIds.has(reviewId)) return;

    setVotedIds((prev) => new Set(prev).add(reviewId));
    setHelpfulCounts((prev) => ({
      ...prev,
      [reviewId]: (prev[reviewId] ?? 0) + 1,
    }));

    const res = await voteHelpfulReviewAction({ reviewId });
    if (!res.ok) {
      // Revert if failed
      setVotedIds((prev) => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
      setHelpfulCounts((prev) => ({
        ...prev,
        [reviewId]: Math.max(0, (prev[reviewId] ?? 1) - 1),
      }));
      toast.error('Could not record vote');
    }
  };

  // Filter reviews
  let filtered = reviews.filter((r) => {
    if (selectedRating !== null && r.rating !== selectedRating) return false;
    if (photosOnly && r.media.length === 0) return false;
    return true;
  });

  // Sort reviews
  filtered = [...filtered].sort((a, b) => {
    if (sortOrder === 'rating_desc') {
      return b.rating - a.rating;
    }
    if (sortOrder === 'helpful') {
      const aHelp = helpfulCounts[a.id] ?? a.helpfulCount;
      const bHelp = helpfulCounts[b.id] ?? b.helpfulCount;
      return bHelp - aHelp;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const totalReviews = stats.reviewCount;
  const avgRating = stats.averageRating;
  const trueToSizePct = stats.fitTrueToSizePercentage;

  return (
    <section
      id="reviews"
      aria-labelledby="pdp-reviews-heading"
      className="border-t border-line bg-page py-16 md:py-24"
    >
      <div className="container-page">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="type-eyebrow text-accent-text">Client Testimonials &amp; Fit</span>
            <h2
              id="pdp-reviews-heading"
              className="mt-2 font-display text-2xl font-light tracking-tight text-fg md:text-4xl"
            >
              Verified Client Reviews
            </h2>
            <p className="mt-2 type-body-sm text-fg-muted">
              Honest feedback on collar proportions, drape, noble fibers, and doorstep fittings.
            </p>
          </div>

          <Button
            onClick={() => setWriteModalOpen(true)}
            size="lg"
            className="gap-2 self-start bg-ink text-ivory hover:bg-ink/90 sm:self-auto"
          >
            <PenSquare size={16} />
            <span>Write an Atelier Review</span>
          </Button>
        </div>

        {/* Rating Breakdown & Fit Meter Stage */}
        <div className="mt-10 grid gap-6 rounded-xs border border-line bg-raised/40 p-6 md:grid-cols-12 md:gap-8 md:p-8">
          {/* Column 1: Overall Score */}
          <div className="flex flex-col justify-center border-b border-line pb-6 md:col-span-4 md:border-r md:border-b-0 md:pr-8 md:pb-0">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-5xl font-light tracking-tight text-fg md:text-6xl">
                {avgRating > 0 ? avgRating.toFixed(1) : '5.0'}
              </span>
              <span className="type-body text-fg-muted">/ 5.0</span>
            </div>

            <div className="mt-2 flex items-center gap-1 text-accent-text">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={18}
                  className={
                    i < Math.round(avgRating || 5) ? 'fill-gold text-accent-text' : 'text-stone-300'
                  }
                />
              ))}
            </div>

            <p className="mt-3 type-body-sm text-fg-muted">
              {totalReviews > 0
                ? `Based on ${totalReviews} verified client reviews`
                : 'Initial atelier reception'}
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs text-accent-text">
              <ShieldCheck size={16} />
              <span>100% Verified Dhaka Atelier Commissions</span>
            </div>
          </div>

          {/* Column 2: Rating Distribution Histogram */}
          <div className="flex flex-col justify-center border-b border-line pb-6 md:col-span-5 md:border-r md:border-b-0 md:px-6 md:pb-0">
            <span className="type-caption font-mono tracking-wider text-fg-muted uppercase">
              Rating Distribution
            </span>
            <div className="mt-3 space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count =
                  stats.ratingDistribution[stars as keyof typeof stats.ratingDistribution] ?? 0;
                const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                return (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => setSelectedRating(selectedRating === stars ? null : stars)}
                    className="group flex w-full items-center gap-3 text-left transition-opacity hover:opacity-80"
                  >
                    <span className="w-12 type-caption font-medium text-fg">{stars} Stars</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                      <div
                        className="h-full bg-gold transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right type-caption font-mono text-fg-muted">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 3: Fit Proportion Meter */}
          <div className="flex flex-col justify-center md:col-span-3 md:pl-2">
            <span className="type-caption font-mono tracking-wider text-fg-muted uppercase">
              Fit Feedback Meter
            </span>

            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-light text-fg">{trueToSizePct}%</span>
                <span className="type-caption text-fg-muted">True to size</span>
              </div>

              {/* Progress bar with 3 segments */}
              <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-raised">
                <div
                  title={`Runs Small: ${stats.fitRunsSmallCount}`}
                  style={{
                    width: `${
                      totalReviews > 0
                        ? Math.round((stats.fitRunsSmallCount / totalReviews) * 100)
                        : 0
                    }%`,
                  }}
                  className="bg-warning/80"
                />
                <div
                  title={`True to size: ${stats.fitTrueToSizeCount}`}
                  style={{
                    width: `${
                      totalReviews > 0
                        ? Math.round((stats.fitTrueToSizeCount / totalReviews) * 100)
                        : 100
                    }%`,
                  }}
                  className="bg-gold"
                />
                <div
                  title={`Runs Large: ${stats.fitRunsLargeCount}`}
                  style={{
                    width: `${
                      totalReviews > 0
                        ? Math.round((stats.fitRunsLargeCount / totalReviews) * 100)
                        : 0
                    }%`,
                  }}
                  className="bg-accent-text"
                />
              </div>

              <div className="mt-3 grid grid-cols-3 text-center type-caption text-fg-muted">
                <div>Small ({stats.fitRunsSmallCount})</div>
                <div className="font-medium text-accent-text">
                  True ({stats.fitTrueToSizeCount})
                </div>
                <div>Large ({stats.fitRunsLargeCount})</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Chips & Sort Controls */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedRating(null);
                setPhotosOnly(false);
              }}
              className={`rounded-xs px-3 py-1.5 type-caption font-medium transition-colors ${
                selectedRating === null && !photosOnly
                  ? 'bg-ink text-ivory'
                  : 'bg-raised text-fg-muted hover:bg-raised/80 hover:text-fg'
              }`}
            >
              All Reviews ({reviews.length})
            </button>

            <button
              type="button"
              onClick={() => setPhotosOnly(!photosOnly)}
              className={`flex items-center gap-1.5 rounded-xs px-3 py-1.5 type-caption font-medium transition-colors ${
                photosOnly
                  ? 'bg-ink text-ivory'
                  : 'bg-raised text-fg-muted hover:bg-raised/80 hover:text-fg'
              }`}
            >
              <Camera size={14} />
              <span>With Photos</span>
            </button>

            {[5, 4].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setSelectedRating(selectedRating === star ? null : star)}
                className={`rounded-xs px-3 py-1.5 type-caption font-medium transition-colors ${
                  selectedRating === star
                    ? 'bg-ink text-ivory'
                    : 'bg-raised text-fg-muted hover:bg-raised/80 hover:text-fg'
                }`}
              >
                {star} Stars
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="type-caption text-fg-muted">Sort by:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="h-8 rounded-xs border border-line bg-raised px-2.5 type-caption text-fg"
            >
              <option value="recent">Most Recent</option>
              <option value="rating_desc">Highest Rating</option>
              <option value="helpful">Most Helpful</option>
            </select>
          </div>
        </div>

        {/* Reviews List */}
        <div className="mt-8 space-y-6">
          {filtered.length === 0 ? (
            <div className="rounded-xs border border-line bg-raised/20 py-16 text-center text-fg-muted">
              <MessageSquare size={32} className="mx-auto text-accent-text/60" />
              <p className="mt-3 type-body font-medium text-fg">No reviews match your filter</p>
              <p className="mt-1 type-body-sm text-fg-muted">
                Clear active filters to view all client perspectives.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSelectedRating(null);
                  setPhotosOnly(false);
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            filtered.map((review) => {
              const currentHelpful = helpfulCounts[review.id] ?? review.helpfulCount;
              const hasVoted = votedIds.has(review.id);

              return (
                <div
                  key={review.id}
                  className="rounded-xs border border-line bg-raised/30 p-6 transition-colors hover:border-gold/40 md:p-8"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    {/* Author & Verification */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-base font-medium text-fg">
                          {review.authorName}
                        </span>
                        {review.isVerified && (
                          <Badge tone="gold" className="flex items-center gap-1">
                            <ShieldCheck size={11} />
                            <span>Verified Buyer</span>
                          </Badge>
                        )}
                      </div>

                      {/* Sizing & Fit Verdict Pills */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-0.5 text-accent-text">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={
                                i < review.rating ? 'fill-gold text-accent-text' : 'text-stone-300'
                              }
                            />
                          ))}
                        </div>

                        <span className="text-fg-muted/40">•</span>

                        <Badge tone={review.fitFeedback === 'true_to_size' ? 'neutral' : 'warning'}>
                          {review.fitFeedback === 'true_to_size'
                            ? 'True to Size'
                            : review.fitFeedback === 'runs_small'
                              ? 'Runs Small'
                              : 'Runs Large'}
                        </Badge>

                        {review.sizePurchased && (
                          <span className="rounded-xs border border-line bg-page px-2 py-0.5 type-caption font-mono text-fg-muted">
                            Size: {review.sizePurchased}
                          </span>
                        )}

                        {review.heightCm && (
                          <span className="rounded-xs border border-line bg-page px-2 py-0.5 type-caption font-mono text-fg-muted">
                            Height: {review.heightCm} cm
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Published Date */}
                    <span className="type-caption whitespace-nowrap text-fg-muted">
                      {new Date(review.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Review Headline & Body */}
                  <div className="mt-4">
                    <h3 className="font-serif text-lg font-medium text-fg">{review.title}</h3>
                    <p className="mt-2 type-body-sm leading-relaxed whitespace-pre-wrap text-fg">
                      {review.body}
                    </p>
                  </div>

                  {/* Customer Photos */}
                  {review.media.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {review.media.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setActivePhotoUrl(photo.url)}
                          className="group relative size-20 overflow-hidden rounded-xs border border-line transition-transform hover:scale-105"
                        >
                          <Image
                            src={photo.url}
                            alt="Customer garment photo"
                            fill
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Helpful Vote Action */}
                  <div className="mt-6 flex items-center justify-between border-t border-line/60 pt-4">
                    <span className="type-caption text-fg-muted">Was this review helpful?</span>
                    <button
                      type="button"
                      onClick={() => handleHelpfulClick(review.id)}
                      disabled={hasVoted}
                      className={`flex items-center gap-1.5 rounded-xs border px-3 py-1 type-caption font-medium transition-colors ${
                        hasVoted
                          ? 'border-gold bg-gold/15 text-accent-text'
                          : 'border-line bg-page text-fg-muted hover:border-gold/40 hover:text-fg'
                      }`}
                    >
                      <ThumbsUp size={13} />
                      <span>Helpful ({currentHelpful})</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Write Review Modal */}
      <WriteReviewModal
        productId={productId}
        productTitle={productTitle}
        open={writeModalOpen}
        onOpenChange={setWriteModalOpen}
        onReviewSubmitted={() => {
          toast.success(
            'Your review is being processed. It will display here once curatorial approval completes.',
          );
        }}
      />

      {/* Photo Lightbox Modal */}
      {activePhotoUrl && (
        <Dialog open={!!activePhotoUrl} onOpenChange={() => setActivePhotoUrl(null)}>
          <DialogContent className="bg-black/90 max-w-3xl border-none p-2 text-ivory">
            <div className="relative aspect-square max-h-[80vh] w-full">
              <Image
                src={activePhotoUrl}
                alt="Enlarged review photo"
                fill
                className="object-contain"
              />
            </div>
            <div className="text-right">
              <Button variant="secondary" size="sm" onClick={() => setActivePhotoUrl(null)}>
                Close Preview
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
