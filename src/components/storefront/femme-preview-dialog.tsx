'use client';

import { Sparkles, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { useTranslation } from '@/lib/i18n/context';

interface FemmePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Editorial modal presenting AUREN FEMME (Womenswear preview).
 * Collects VIP early access requests while conveying the brand's quiet luxury vision.
 */
export function FemmePreviewDialog({ open, onOpenChange }: FemmePreviewDialogProps) {
  const { isBn } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error(isBn ? 'সঠিক ইমেইল এড্রেস লিখুন' : 'Please enter a valid email address');
      return;
    }
    setLoading(true);
    // Simulate luxury salon registration
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      toast.success(
        isBn
          ? 'ধন্যবাদ! অরেন ফেম প্রাইভেট স্যালন লিস্টে আপনি যুক্ত হয়েছেন।'
          : 'You are on the AUREN FEMME Private Salon guestlist.',
      );
    }, 600);
  }

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTimeout(() => {
        setSubmitted(false);
        setEmail('');
      }, 300);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border-line/80 bg-page/98 p-6 backdrop-blur-md md:p-8">
        <DialogHeader>
          <div className="flex items-center gap-1.5 type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase">
            <Icon icon={Sparkles} size={14} />
            <span>{isBn ? 'অরেন এতিলে · প্রিভিউ' : 'Auren Atelier · Preview'}</span>
          </div>
          <DialogTitle className="mt-2 type-display-lg font-display text-fg">
            {isBn ? 'অরেন ফেম: ইন ক্রিয়েশন' : 'Auren Femme: In Creation'}
          </DialogTitle>
          <DialogDescription className="mt-2 type-body text-pretty text-fg-muted">
            {isBn
              ? 'পরিমিত আভিজাত্য ও আর্কিটেকচারাল ফ্যাশনের সমন্বয়ে আসছে মহিলাদের জন্য আমাদের বিশেষ নারী পোশাক সংকলন।'
              : "Translating AUREN's signature architectural drape, noble natural fibers, and quiet luxury tailoring into fluid, sculpted feminine silhouettes."}
          </DialogDescription>
        </DialogHeader>

        {/* Capsule Pillar Highlights */}
        <div className="my-6 grid grid-cols-2 gap-3 border-y border-line/50 py-4">
          <div className="border-l border-gold/40 pl-3">
            <span className="type-caption font-mono text-accent-text uppercase">01 / Fibers</span>
            <p className="mt-0.5 type-small font-medium text-fg">Mulberry Silk & Linen</p>
          </div>
          <div className="border-l border-gold/40 pl-3">
            <span className="type-caption font-mono text-accent-text uppercase">
              02 / Silhouettes
            </span>
            <p className="mt-0.5 type-small font-medium text-fg">Sculpted Ease</p>
          </div>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center rounded-xs border border-gold/40 bg-gold/5 p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-gold text-ink">
              <Icon icon={Check} size={20} />
            </div>
            <h4 className="mt-3 type-h3 font-medium text-fg">
              {isBn ? 'আমন্ত্রণ তালিকাভুক্ত হয়েছে' : 'Invitation Reserved'}
            </h4>
            <p className="mt-1.5 type-small text-fg-muted">
              {isBn
                ? 'রিলিজের পূর্বে আমরা আপনাকে ব্যক্তিগত প্রাইভেট প্রিভিউ লিংক পাঠাবো।'
                : 'You will receive private salon access and lookbook preview prior to the public release.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleClose(false)}
              className="mt-4"
            >
              {isBn ? 'বন্ধ করুন' : 'Return to Atelier'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="type-small font-medium text-fg">
              {isBn
                ? 'ভিআইপি প্রাইভেট স্যালন অ্যাক্সেস পান:'
                : 'Join the VIP Private Salon guestlist:'}
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@domain.com"
                className="flex-1 bg-sunken/60"
                aria-label="Email for womenswear private preview"
              />
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="shrink-0 tracking-button"
              >
                {isBn ? 'যুক্ত হোন' : 'Request Access'}
              </Button>
            </div>
            <p className="type-caption text-fg-muted/80">
              {isBn
                ? '✦ কোনো স্প্যাম নয় · শুধুমাত্র এক্সক্লুসিভ কালেকশন প্রিভিউ নোটিফিকেশন'
                : '✦ Zero marketing spam · Private collection debut notifications only'}
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
