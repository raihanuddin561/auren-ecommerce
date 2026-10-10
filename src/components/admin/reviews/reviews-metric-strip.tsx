'use client';

import { Clock, MessageSquareQuote, ShieldCheck, Star } from 'lucide-react';
import type { AdminReviewsOverviewMetrics } from '@/modules/reviews/types';

interface ReviewsMetricStripProps {
  metrics: AdminReviewsOverviewMetrics;
}

export function ReviewsMetricStrip({ metrics }: ReviewsMetricStripProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="shadow-xs rounded-xs border border-line bg-raised/70 p-5">
        <div className="flex items-center justify-between">
          <span className="type-caption font-mono tracking-widest text-fg-muted uppercase">
            Total Reviews
          </span>
          <div className="flex size-7 items-center justify-center rounded-xs border border-line bg-page text-accent-text">
            <MessageSquareQuote size={15} />
          </div>
        </div>
        <p className="mt-3 font-serif text-2xl font-semibold tracking-tight text-fg">
          {metrics.totalCount}
        </p>
        <p className="mt-1 type-caption text-fg-muted">All customer submissions across catalog</p>
      </div>

      <div className="shadow-xs rounded-xs border border-line bg-raised/70 p-5">
        <div className="flex items-center justify-between">
          <span className="type-caption font-mono tracking-widest text-fg-muted uppercase">
            Pending Queue
          </span>
          <div
            className={`flex size-7 items-center justify-center rounded-xs border ${
              metrics.pendingCount > 0
                ? 'border-warning/40 bg-warning/10 text-warning-text'
                : 'border-line bg-page text-fg-muted'
            }`}
          >
            <Clock size={15} />
          </div>
        </div>
        <p
          className={`mt-3 font-serif text-2xl font-semibold tracking-tight ${
            metrics.pendingCount > 0 ? 'text-warning-text' : 'text-fg'
          }`}
        >
          {metrics.pendingCount}
        </p>
        <p className="mt-1 type-caption text-fg-muted">
          {metrics.pendingCount === 0 ? 'Moderation queue clear' : 'Awaiting curator approval'}
        </p>
      </div>

      <div className="shadow-xs rounded-xs border border-line bg-raised/70 p-5">
        <div className="flex items-center justify-between">
          <span className="type-caption font-mono tracking-widest text-fg-muted uppercase">
            Average Rating
          </span>
          <div className="flex size-7 items-center justify-center rounded-xs border border-line bg-page text-accent-text">
            <Star size={15} />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="font-serif text-2xl font-semibold tracking-tight text-fg">
            {metrics.averageRating > 0 ? metrics.averageRating.toFixed(1) : '—'}
          </p>
          <span className="type-caption text-fg-muted">/ 5.0</span>
        </div>
        <p className="mt-1 type-caption text-fg-muted">
          {metrics.approvedCount} approved storefront reviews
        </p>
      </div>

      <div className="shadow-xs rounded-xs border border-line bg-raised/70 p-5">
        <div className="flex items-center justify-between">
          <span className="type-caption font-mono tracking-widest text-fg-muted uppercase">
            Verified Buyers
          </span>
          <div className="flex size-7 items-center justify-center rounded-xs border border-line bg-page text-success-text">
            <ShieldCheck size={15} />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="font-serif text-2xl font-semibold tracking-tight text-fg">
            {metrics.verifiedBuyerPercentage}%
          </p>
        </div>
        <p className="mt-1 type-caption text-fg-muted">Delivered atelier commissions</p>
      </div>
    </div>
  );
}
