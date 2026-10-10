'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { submitReviewAction } from '@/modules/reviews/actions';
import type { FitFeedback } from '@/modules/reviews/types';
import { Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface WriteReviewModalProps {
  productId: string;
  productTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewSubmitted?: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Unsatisfactory',
  2: 'Needs refinement',
  3: 'Met expectations',
  4: 'Exceeded expectations',
  5: 'Exceptional craftsmanship',
};

export function WriteReviewModal({
  productId,
  productTitle,
  open,
  onOpenChange,
  onReviewSubmitted,
}: WriteReviewModalProps) {
  const [isPending, startTransition] = useTransition();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fitFeedback, setFitFeedback] = useState<FitFeedback>('true_to_size');
  const [sizePurchased, setSizePurchased] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    try {
      new URL(newPhotoUrl.trim());
      if (mediaUrls.length >= 5) {
        toast.error('Maximum 5 photos allowed');
        return;
      }
      setMediaUrls([...mediaUrls, newPhotoUrl.trim()]);
      setNewPhotoUrl('');
    } catch {
      toast.error('Please enter a valid image URL');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || title.trim().length < 2) {
      toast.error('Please enter a descriptive headline');
      return;
    }
    if (!body.trim() || body.trim().length < 10) {
      toast.error('Please write at least 10 characters describing your experience');
      return;
    }
    if (!authorName.trim() || authorName.trim().length < 2) {
      toast.error('Please enter your name');
      return;
    }

    startTransition(async () => {
      const res = await submitReviewAction({
        productId,
        rating,
        title: title.trim(),
        body: body.trim(),
        fitFeedback,
        sizePurchased: sizePurchased.trim() || undefined,
        heightCm: heightCm ? parseInt(heightCm, 10) : undefined,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || undefined,
        mediaUrls,
      });

      if (res.ok) {
        toast.success('Thank you. Your review has been submitted to our atelier curatorial queue.');
        onOpenChange(false);
        // Reset form
        setTitle('');
        setBody('');
        setSizePurchased('');
        setHeightCm('');
        setMediaUrls([]);
        if (onReviewSubmitted) onReviewSubmitted();
      } else {
        toast.error(res.error.message || 'Failed to submit review');
      }
    });
  };

  const activeStarCount = hoverRating ?? rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-line bg-page text-fg">
        <DialogHeader>
          <span className="type-eyebrow text-accent-text">Atelier Verification</span>
          <DialogTitle className="mt-1 font-serif text-2xl font-normal text-fg">
            Write an Atelier Review
          </DialogTitle>
          <DialogDescription className="text-fg-muted">
            Share your perspective on the fit, noble fibers, and craftsmanship of{' '}
            <strong className="font-medium text-fg">{productTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Star Rating Picker */}
          <div>
            <label className="type-caption font-medium tracking-wider text-fg uppercase">
              Overall Rating
            </label>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 text-accent-text transition-transform hover:scale-110 focus:outline-none"
                    aria-label={`${star} stars`}
                  >
                    <Star
                      size={24}
                      className={
                        star <= activeStarCount ? 'fill-gold text-accent-text' : 'text-stone-300'
                      }
                    />
                  </button>
                ))}
              </div>
              <span className="type-body-sm font-medium text-fg">
                {RATING_LABELS[activeStarCount]}
              </span>
            </div>
          </div>

          {/* Fit Feedback Selector */}
          <div>
            <label className="type-caption font-medium tracking-wider text-fg uppercase">
              Fit Proportion
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { id: 'runs_small', label: 'Runs Small' },
                { id: 'true_to_size', label: 'True to Size' },
                { id: 'runs_large', label: 'Runs Large' },
              ].map((fit) => (
                <button
                  key={fit.id}
                  type="button"
                  onClick={() => setFitFeedback(fit.id as FitFeedback)}
                  className={`rounded-xs border px-3 py-2 text-center type-caption font-medium transition-all ${
                    fitFeedback === fit.id
                      ? 'border-gold bg-gold/15 text-accent-text'
                      : 'border-line bg-raised text-fg-muted hover:border-gold/40 hover:text-fg'
                  }`}
                >
                  {fit.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sizing Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="size-purchased" className="type-caption font-medium text-fg">
                Size Purchased (Optional)
              </label>
              <Input
                id="size-purchased"
                placeholder="e.g. M, 32, 40R"
                value={sizePurchased}
                onChange={(e) => setSizePurchased(e.target.value)}
                className="mt-1 h-9 border-line bg-raised text-xs text-fg"
              />
            </div>
            <div>
              <label htmlFor="height-cm" className="type-caption font-medium text-fg">
                Your Height in cm (Optional)
              </label>
              <Input
                id="height-cm"
                type="number"
                placeholder="e.g. 178"
                min={100}
                max={250}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="mt-1 h-9 border-line bg-raised text-xs text-fg"
              />
            </div>
          </div>

          {/* Headline & Body */}
          <div className="space-y-4">
            <div>
              <label htmlFor="review-title" className="type-caption font-medium text-fg">
                Review Headline
              </label>
              <Input
                id="review-title"
                placeholder="e.g. Flawless collar roll and breathable linen weave"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 h-9 border-line bg-raised text-xs text-fg"
                required
              />
            </div>
            <div>
              <label htmlFor="review-body" className="type-caption font-medium text-fg">
                Review Narrative
              </label>
              <Textarea
                id="review-body"
                placeholder="How does the fabric drape? How was the doorstep fitting? What setting did you wear it for?..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1 border-line bg-raised text-xs text-fg"
                rows={4}
                required
              />
              <span className="mt-1 block text-right type-caption text-fg-muted">
                {body.length} / 3000 characters
              </span>
            </div>
          </div>

          {/* Customer Credentials */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="author-name" className="type-caption font-medium text-fg">
                Your Name
              </label>
              <Input
                id="author-name"
                placeholder="e.g. Raihan Ahmed"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="mt-1 h-9 border-line bg-raised text-xs text-fg"
                required
              />
            </div>
            <div>
              <label htmlFor="author-email" className="type-caption font-medium text-fg">
                Your Email Address
              </label>
              <Input
                id="author-email"
                type="email"
                placeholder="For verified buyer badge match"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                className="mt-1 h-9 border-line bg-raised text-xs text-fg"
              />
            </div>
          </div>

          {/* Attached Customer Photography */}
          <div>
            <label className="type-caption font-medium text-fg">
              Attach Garment Photography (Optional, max 5)
            </label>
            <div className="mt-2 flex gap-2">
              <Input
                type="url"
                placeholder="Paste public image URL (https://...)"
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                className="h-9 border-line bg-raised text-xs text-fg"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddPhoto}
                disabled={mediaUrls.length >= 5}
                className="gap-1 px-3 whitespace-nowrap"
              >
                <Plus size={14} />
                <span>Add</span>
              </Button>
            </div>

            {mediaUrls.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {mediaUrls.map((url, i) => (
                  <div
                    key={i}
                    className="group relative size-16 overflow-hidden rounded-xs border border-line"
                  >
                    <Image src={url} alt="Attached photo" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(i)}
                      className="bg-black/60 absolute inset-0 flex items-center justify-center text-ivory opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xs border border-line bg-raised/50 p-3 text-xs text-fg-muted">
            <div className="flex items-center gap-1.5 font-medium text-accent-text">
              <ShieldCheck size={14} />
              <span>Verified Buyer Protection</span>
            </div>
            <p className="mt-1 type-caption">
              Submissions are cross-referenced with delivered orders. Reviews are curated to
              preserve the integrity of the AUREN client community.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-ink text-ivory hover:bg-ink/90"
            >
              {isPending ? 'Submitting...' : 'Submit Atelier Review'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
