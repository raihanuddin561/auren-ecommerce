'use client';

import { Loader2, Tag, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/components/ui/price';
import { deserialize } from '@/lib/money';
import { applyDiscountCodeAction, removeDiscountCodeAction } from '@/modules/promotions/actions';
import type { CheckoutSummary } from '@/modules/checkout/types';

interface OrderSummaryBodyProps {
  summary: CheckoutSummary;
  onCouponChange?: () => void;
}

/** Items and the totals breakdown with interactive discount coupon support. */
export function OrderSummaryBody({ summary, onCouponChange }: OrderSummaryBodyProps) {
  const router = useRouter();
  const { cart, totals, delivery, discount } = summary;
  const shipping = totals.shipping ? deserialize(totals.shipping) : null;
  const total = totals.total ? deserialize(totals.total) : null;
  const discountAmount = totals.discount ? deserialize(totals.discount) : null;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply(event: React.FormEvent) {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    setError(null);

    const result = await applyDiscountCodeAction({ code: clean });
    setLoading(false);

    if (result.ok) {
      setCode('');
      onCouponChange?.();
      router.refresh();
    } else {
      setError(result.error.message ?? 'Invalid or expired discount code');
    }
  }

  async function handleRemove() {
    setLoading(true);
    setError(null);

    const result = await removeDiscountCodeAction();
    setLoading(false);

    if (result.ok) {
      onCouponChange?.();
      router.refresh();
    } else {
      setError(result.error.message ?? 'Failed to remove discount');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-line">
        {cart.lines.map((line) => (
          <li key={line.variantId} className="flex gap-4 py-4 first:pt-0">
            <div
              className="relative w-16 shrink-0 overflow-hidden bg-stone-200"
              style={{ aspectRatio: '4 / 5' }}
            >
              {line.image ? (
                <Image src={line.image.url} alt="" fill sizes="64px" className="object-cover" />
              ) : null}
              <span
                aria-hidden="true"
                className="absolute top-0 right-0 bg-fg px-1.5 py-0.5 text-eyebrow leading-none text-page tabular-nums"
              >
                {line.quantity}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="type-small text-fg">{line.productTitle}</p>
                <p className="type-small text-fg-muted">
                  {line.optionsLabel}
                  <span className="sr-only">, quantity {line.quantity}</span>
                </p>
              </div>
              <p className="type-small text-fg tabular-nums">
                {formatPrice(deserialize(line.lineTotal))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Coupon Application / Active Promo Section */}
      <div className="border-t border-line pt-4">
        {discount ? (
          <div className="rounded border-accent/40 bg-accent/5 flex items-center justify-between border p-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-accent-text" />
              <div>
                <p className="type-small font-medium tracking-wider text-fg uppercase">
                  {discount.code}
                </p>
                <p className="type-eyebrow text-fg-muted">{discount.title}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-danger disabled:opacity-50"
              aria-label={`Remove discount code ${discount.code}`}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleApply} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="Promo code"
                maxLength={30}
                className="rounded h-9 min-w-0 flex-1 border border-line bg-page px-3 text-xs text-fg uppercase placeholder:text-fg-muted placeholder:normal-case focus:border-gold focus:outline-none"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={!code.trim() || loading}
                loading={loading}
              >
                Apply
              </Button>
            </div>
            {error ? (
              <p role="alert" className="type-eyebrow text-danger-text">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>

      <dl className="flex flex-col gap-2 border-t border-line pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-small text-fg-muted">Subtotal</dt>
          <dd className="type-small text-fg tabular-nums">
            {formatPrice(deserialize(totals.subtotal))}
          </dd>
        </div>

        {discount && discountAmount && discountAmount.minor > 0n ? (
          <div className="flex items-baseline justify-between gap-4 text-accent-text">
            <dt className="type-small">Discount ({discount.code})</dt>
            <dd className="type-small font-medium tabular-nums">-{formatPrice(discountAmount)}</dd>
          </div>
        ) : null}

        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-small text-fg-muted">
            Delivery{delivery ? ` (${delivery.zoneName})` : ''}
          </dt>
          <dd className="type-small text-fg tabular-nums">
            {shipping === null
              ? 'Choose your district'
              : shipping.minor === 0n
                ? 'Complimentary'
                : formatPrice(shipping)}
          </dd>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <dt className="type-body text-fg">Total</dt>
          <dd className="type-price text-h3 text-fg tabular-nums" data-testid="order-total">
            {total ? formatPrice(total) : formatPrice(deserialize(totals.subtotal))}
          </dd>
        </div>
        <p className="type-small text-fg-muted">Prices include tax.</p>
      </dl>

      <Link
        href="/cart"
        className="type-small text-fg underline decoration-gold underline-offset-4 hover:decoration-2"
      >
        Edit your bag
      </Link>
    </div>
  );
}
