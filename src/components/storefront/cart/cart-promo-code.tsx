'use client';

import { Check, ChevronDown, ChevronUp, Loader2, Tag, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  applyDiscountCodeAction,
  getAppliedCouponAction,
  removeDiscountCodeAction,
} from '@/modules/promotions/actions';

interface CartPromoCodeProps {
  /** Optional initial coupon code if already known from server */
  initialCode?: string | null;
  /** Compact mode for narrow drawers */
  compact?: boolean;
}

export function CartPromoCode({ initialCode = null, compact = false }: CartPromoCodeProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(initialCode);
  const [prevInitialCode, setPrevInitialCode] = useState<string | null>(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (initialCode !== prevInitialCode) {
    setPrevInitialCode(initialCode);
    setAppliedCode(initialCode);
  }

  // Sync with server if not passed initially
  useEffect(() => {
    if (initialCode) return;
    let cancelled = false;
    getAppliedCouponAction().then((res) => {
      if (!cancelled && res.ok && res.data.code) {
        setAppliedCode(res.data.code);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialCode]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    setError(null);

    const res = await applyDiscountCodeAction({ code: clean });
    setLoading(false);

    if (res.ok) {
      setAppliedCode(res.data.code);
      setCode('');
      setIsOpen(false);
      toast.success('Promo code applied', `Code ${res.data.code} added to your bag.`);
      router.refresh();
    } else {
      setError(res.error.message ?? 'Invalid or expired promo code');
    }
  }

  async function handleRemove() {
    setLoading(true);
    setError(null);

    const res = await removeDiscountCodeAction();
    setLoading(false);

    if (res.ok) {
      setAppliedCode(null);
      toast.message('Promo code removed', 'Your bag has been updated.');
      router.refresh();
    } else {
      setError(res.error.message ?? 'Failed to remove discount');
    }
  }

  // State A: A coupon is currently applied
  if (appliedCode) {
    return (
      <div
        className={
          compact
            ? 'flex items-center justify-between rounded-xs border border-gold/40 bg-gold/5 px-2.5 py-1.5'
            : 'flex items-center justify-between rounded-xs border border-gold/40 bg-gold/5 px-3 py-2'
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <Tag className="h-4 w-4 shrink-0 text-gold" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate type-caption font-mono font-semibold tracking-wider text-gold-strong uppercase dark:text-gold">
                {appliedCode}
              </span>
              <span className="inline-flex items-center gap-0.5 type-caption font-medium text-success">
                <Check className="h-3 w-3" />
                Applied
              </span>
            </div>
            <p className="truncate type-caption text-fg-muted">
              Discount will be deducted at checkout
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading}
          aria-label="Remove promo code"
          className="ml-2 inline-flex size-6 shrink-0 items-center justify-center rounded-xs text-fg-muted transition-colors hover:bg-gold/10 hover:text-fg disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    );
  }

  // State B: Collapsed trigger
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-between py-1.5 type-caption font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <span className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-gold" />
          <span>Have a promo code?</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    );
  }

  // State C: Expanded input form
  return (
    <div
      className={
        compact
          ? 'flex flex-col gap-1.5 rounded-xs border border-line bg-sunken/40 p-2.5'
          : 'flex flex-col gap-2 rounded-xs border border-line bg-sunken/40 p-3'
      }
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 type-caption font-medium text-fg">
          <Tag className="h-3.5 w-3.5 text-gold" />
          <span>Enter Promo Code</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
          className="text-fg-muted transition-colors hover:text-fg"
          aria-label="Close promo code input"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>

      <form onSubmit={handleApply} className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. AUREN-7X9K2M"
          className="font-mono text-xs tracking-wider uppercase"
          disabled={loading}
          autoFocus
        />
        <Button
          type="submit"
          size="sm"
          disabled={loading || !code.trim()}
          loading={loading}
          className="shrink-0"
        >
          Apply
        </Button>
      </form>

      {error ? (
        <p role="alert" className="type-caption text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
