'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { moderateReviewAction } from '@/modules/reviews/actions';
import type { ReviewItem } from '@/modules/reviews/types';
import { CheckCircle2, ExternalLink, ShieldCheck, Star, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewDetailModalProps {
  review: ReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewDetailModal({ review, open, onOpenChange }: ReviewDetailModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [moderationNote, setModerationNote] = useState('');
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);

  if (!review) return null;

  const handleModerate = (status: 'approved' | 'rejected') => {
    startTransition(async () => {
      const res = await moderateReviewAction({
        reviewId: review.id,
        status,
        moderationNote: moderationNote.trim() || undefined,
      });

      if (res.ok) {
        toast.success(
          status === 'approved'
            ? 'Review has been approved and published to storefront'
            : 'Review has been rejected',
        );
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error.message || 'Failed to moderate review');
      }
    });
  };

  const fitBadgeTone =
    review.fitFeedback === 'true_to_size'
      ? 'neutral'
      : review.fitFeedback === 'runs_small'
        ? 'warning'
        : 'warning';

  const fitLabel =
    review.fitFeedback === 'true_to_size'
      ? 'True to Size'
      : review.fitFeedback === 'runs_small'
        ? 'Runs Small'
        : 'Runs Large';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-line bg-page text-fg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge
              tone={
                review.status === 'approved'
                  ? 'success'
                  : review.status === 'rejected'
                    ? 'danger'
                    : 'warning'
              }
            >
              {review.status}
            </Badge>
            {review.isVerified && (
              <Badge tone="gold" className="flex items-center gap-1">
                <ShieldCheck size={12} />
                <span>Verified Buyer</span>
              </Badge>
            )}
          </div>
          <DialogTitle className="mt-2 font-serif text-xl font-medium text-fg">
            {review.title}
          </DialogTitle>
          <DialogDescription className="text-fg-muted">
            Submitted on{' '}
            {new Date(review.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Product link */}
          <div className="rounded-xs border border-line bg-raised/50 p-3">
            <span className="type-caption text-fg-muted uppercase">Catalog Item:</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="type-body-sm font-medium text-fg">
                {review.productTitle || 'Product'}
              </span>
              {review.productSlug && (
                <Link
                  href={`/products/${review.productSlug}`}
                  target="_blank"
                  className="flex items-center gap-1 text-xs text-accent-text hover:underline"
                >
                  <span>View on Storefront</span>
                  <ExternalLink size={12} />
                </Link>
              )}
            </div>
          </div>

          {/* Rating and client attributes */}
          <div className="grid grid-cols-2 gap-4 rounded-xs border border-line bg-raised/50 p-3 sm:grid-cols-4">
            <div>
              <span className="type-caption text-fg-muted">Rating</span>
              <div className="mt-1 flex items-center gap-1 text-accent-text">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={i < review.rating ? 'fill-gold text-accent-text' : 'text-stone-300'}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="type-caption text-fg-muted">Client</span>
              <p className="mt-1 type-body-sm font-medium text-fg">{review.authorName}</p>
              {review.authorEmail && (
                <p className="type-caption text-fg-muted">{review.authorEmail}</p>
              )}
            </div>

            <div>
              <span className="type-caption text-fg-muted">Fit Verdict</span>
              <div className="mt-1">
                <Badge tone={fitBadgeTone}>{fitLabel}</Badge>
              </div>
            </div>

            <div>
              <span className="type-caption text-fg-muted">Measurements</span>
              <p className="mt-1 type-body-sm text-fg">
                {review.sizePurchased ? `Size: ${review.sizePurchased}` : '—'}
                {review.heightCm ? ` • ${review.heightCm} cm` : ''}
              </p>
            </div>
          </div>

          {/* Review body */}
          <div>
            <span className="type-caption text-fg-muted uppercase">Review Narrative</span>
            <p className="mt-2 type-body-sm leading-relaxed whitespace-pre-wrap text-fg">
              {review.body}
            </p>
          </div>

          {/* Customer media photos */}
          {review.media.length > 0 && (
            <div>
              <span className="type-caption text-fg-muted uppercase">
                Customer Photography ({review.media.length})
              </span>
              <div className="mt-2 flex flex-wrap gap-3">
                {review.media.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActiveMediaUrl(m.url)}
                    className="relative size-20 overflow-hidden rounded-xs border border-line transition-transform hover:scale-105"
                  >
                    <Image src={m.url} alt="Review attachment" fill className="object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Moderation note input */}
          <div className="border-t border-line pt-4">
            <label htmlFor="moderation-note" className="type-caption font-medium text-fg">
              Curator Moderation Note (Optional)
            </label>
            <Textarea
              id="moderation-note"
              placeholder="Internal reasoning (e.g. verified fit exchange, confirmed authentic client photos)..."
              value={moderationNote}
              onChange={(e) => setModerationNote(e.target.value)}
              className="mt-1.5 border-line bg-raised text-xs text-fg"
              rows={2}
            />
            {review.moderationNote && (
              <p className="mt-1 type-caption text-fg-muted">
                Previous note: &ldquo;{review.moderationNote}&rdquo;
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>

          {review.status !== 'rejected' && (
            <Button
              variant="danger"
              onClick={() => handleModerate('rejected')}
              disabled={isPending}
              className="gap-1.5"
            >
              <XCircle size={15} />
              <span>Reject</span>
            </Button>
          )}

          {review.status !== 'approved' && (
            <Button
              onClick={() => handleModerate('approved')}
              disabled={isPending}
              className="gap-1.5 bg-ink text-ivory hover:bg-ink/90"
            >
              <CheckCircle2 size={15} />
              <span>Approve &amp; Publish</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Lightbox photo modal */}
      {activeMediaUrl && (
        <Dialog open={!!activeMediaUrl} onOpenChange={() => setActiveMediaUrl(null)}>
          <DialogContent className="bg-black/90 max-w-3xl border-none p-2 text-ivory">
            <div className="relative aspect-square max-h-[80vh] w-full">
              <Image
                src={activeMediaUrl}
                alt="Enlarged review photo"
                fill
                className="object-contain"
              />
            </div>
            <div className="text-right">
              <Button variant="secondary" size="sm" onClick={() => setActiveMediaUrl(null)}>
                Close Preview
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
