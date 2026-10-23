'use client';

import { Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Price } from '@/components/ui/price';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import type { LivePrice, PdpColor, PdpSize, PdpSizeChart, PdpVariant } from '@/modules/catalog/pdp';
import { addToBag } from '../cart/cart-client';
import { closeCartDrawer } from '../cart/cart-store';
import { WishlistButton } from '../catalog/wishlist-button';
import {
  blockReason,
  colorSoldOut,
  maxQuantity,
  resolveVariant,
  sizeOptions,
  stockNote,
} from './buy-logic';
import { usePdpState } from './pdp-state';
import { SizeGuideDrawer } from './size-guide-drawer';
import { useTranslation } from '@/lib/i18n/context';
import { translateColor, translateSize, toBengaliDigits } from '@/lib/i18n/catalog-translator';

interface BuyBoxProps {
  productId: string;
  title: string;
  colors: PdpColor[];
  sizes: PdpSize[];
  variants: PdpVariant[];
  live: LivePrice;
  sizeChart: PdpSizeChart | null;
}

const isLetterSize = (label: string) => /^(x{0,3}s|m|l|x{1,3}l)$/i.test(label.trim());

/**
 * Colour, size, quantity and add to bag. Prices and units come from the live read next to the
 * cached shell; every choice is validated again on the server when the item is added.
 */
export function BuyBox({
  productId,
  title,
  colors,
  sizes,
  variants,
  live,
  sizeChart,
}: BuyBoxProps) {
  const { colorId, sizeId, setColorId, setSizeId } = usePdpState();
  const { locale, isBn } = useTranslation();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
  const [buyNowPending, startBuyNowTransition] = useTransition();
  const [showChoose, setShowChoose] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const liveById = useMemo(() => new Map(live.variants.map((v) => [v.id, v])), [live.variants]);
  const options = useMemo(
    () => sizeOptions(sizes, variants, liveById, colorId),
    [sizes, variants, liveById, colorId],
  );
  const chosen = options.find((option) => option.sizeId === sizeId);
  const variant = resolveVariant(variants, colorId, sizeId);
  const liveVariant = variant ? liveById.get(variant.id) : undefined;
  const anyAvailable = live.variants.some((entry) => entry.available > 0);
  const sizesPending = sizeChart !== null && sizes.length === 0;
  const reason = blockReason({
    hasSizes: sizes.length > 0,
    sizeChosen: Boolean(chosen),
    variantAvailable: liveVariant ? liveVariant.available : null,
    anyAvailable,
    sizesPending,
  });
  const color = colors.find((entry) => entry.id === colorId);
  const note = stockNote(chosen);
  // With nothing chosen yet, say which sizes are nearly gone.
  const lowSizes = options.filter((option) => option.state === 'low');
  const lowAtRest =
    !chosen && lowSizes.length > 0
      ? `Nearly gone: ${lowSizes.map((option) => `${option.label} (${option.available} left)`).join(', ')}.`
      : null;
  const limit = maxQuantity(liveVariant?.available ?? 0);
  // A smaller limit (another size or colour) pulls the shown quantity down without an effect.
  const shownQuantity = Math.min(quantity, Math.max(1, limit));

  // The sticky bar appears once the main button has scrolled out of view (mobile only).
  useEffect(() => {
    const element = buttonRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setBarVisible(entry ? !entry.isIntersecting && entry.boundingClientRect.top < 0 : false),
      { threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const priceNode = (() => {
    const source = liveVariant ?? null;
    if (source) {
      return (
        <Price
          size="lg"
          price={deserialize(source.price)}
          compareAt={source.compareAt ? deserialize(source.compareAt) : null}
        />
      );
    }
    const cheapest = [...live.variants].sort((a, b) =>
      BigInt(a.price.minor) < BigInt(b.price.minor) ? -1 : 1,
    )[0];
    return cheapest ? (
      <Price
        size="lg"
        price={deserialize(cheapest.price)}
        compareAt={cheapest.compareAt ? deserialize(cheapest.compareAt) : null}
      />
    ) : null;
  })();

  function add() {
    if (reason === 'choose-size') {
      setShowChoose(true);
      document.getElementById('size-group')?.focus();
      return;
    }
    if (reason || !variant) return;
    startTransition(async () => {
      // The server answers with the whole bag and the drawer opens; failures are toasted there.
      await addToBag(variant.id, shownQuantity);
    });
  }

  function buyNow() {
    if (reason === 'choose-size') {
      setShowChoose(true);
      document.getElementById('size-group')?.focus();
      return;
    }
    if (reason || !variant) return;
    startBuyNowTransition(async () => {
      const added = await addToBag(variant.id, shownQuantity);
      if (added) {
        closeCartDrawer();
        router.push('/checkout');
      }
    });
  }

  const buttonLabel =
    reason === 'sizes-pending'
      ? isBn
        ? 'সাইজ আপডেট হচ্ছে'
        : 'Sizes updating'
      : reason === 'sold-out'
        ? isBn
          ? 'স্টক শেষ'
          : 'Sold out'
        : reason === 'choose-size'
          ? isBn
            ? 'সাইজ নির্বাচন করুন'
            : 'Choose a size'
          : isBn
            ? 'ব্যাগে যোগ করুন'
            : 'Add to bag';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        {priceNode}
        <p className="type-small text-fg-muted">{isBn ? 'ভ্যাট অন্তর্ভুক্ত' : 'Tax included'}</p>
      </div>

      {colors.length > 0 ? (
        <fieldset>
          <legend className="type-eyebrow text-fg">
            {isBn ? 'রং' : 'Colour'}{' '}
            <span className="ml-2 tracking-normal text-fg-muted normal-case">
              {translateColor(color?.label, locale)}
            </span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {colors.map((entry) => {
              const out = colorSoldOut(entry, variants, liveById);
              const selected = entry.id === colorId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${entry.label}${out ? ', sold out' : ''}`}
                  onClick={() => {
                    setColorId(entry.id);
                    if (sizeId) {
                      const next = resolveVariant(variants, entry.id, sizeId);
                      if (!next || (liveById.get(next.id)?.available ?? 0) <= 0) setSizeId(null);
                    }
                  }}
                  className={cn(
                    'touch-target relative inline-flex size-11 items-center justify-center transition-auren-fast',
                    selected ? 'border-2 border-fg' : 'border border-line-strong hover:border-fg',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn('block size-7 border border-line', out && 'opacity-50')}
                    style={{ backgroundColor: entry.hex ?? 'var(--color-stone-300)' }}
                  />
                  {out ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 10 10"
                      preserveAspectRatio="none"
                      className="absolute inset-1 size-[calc(100%-0.5rem)] text-fg"
                    >
                      <line
                        x1="0"
                        y1="10"
                        x2="10"
                        y2="0"
                        stroke="currentColor"
                        strokeWidth="0.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizes.length > 0 ? (
        <div className="relative">
          <fieldset>
            <legend className="type-eyebrow text-fg">{isBn ? 'সাইজ' : 'Size'}</legend>
            <div
              id="size-group"
              tabIndex={-1}
              role="group"
              aria-label={isBn ? 'সাইজ নির্বাচন করুন' : 'Choose a size'}
              className="mt-3 flex flex-wrap gap-2 outline-none"
            >
              {options.map((option) => {
                const selected = option.sizeId === sizeId;
                const out = option.state === 'out';
                return (
                  <button
                    key={option.sizeId}
                    type="button"
                    aria-pressed={selected}
                    aria-disabled={out || undefined}
                    aria-label={`${option.label}${out ? ', sold out' : option.state === 'low' ? `, only ${option.available} left` : ''}`}
                    onClick={() => {
                      setShowChoose(false);
                      if (!out) setSizeId(option.sizeId);
                    }}
                    className={cn(
                      'touch-target inline-flex min-h-11 min-w-12 items-center justify-center border px-3 type-small transition-auren-fast',
                      selected
                        ? 'border-fg bg-fg text-page'
                        : out
                          ? 'cursor-not-allowed border-line text-fg-muted line-through'
                          : 'border-line-strong text-fg hover:border-fg',
                    )}
                  >
                    {translateSize(option.label, locale)}
                  </button>
                );
              })}
            </div>
            <p
              role="status"
              className={cn(
                'mt-3 min-h-5 type-small',
                chosen?.state === 'low' ? 'text-warning-text' : 'text-fg-muted',
                showChoose && !chosen && 'text-danger-text',
              )}
            >
              {showChoose && !chosen
                ? isBn
                  ? 'এগিয়ে যেতে একটি সাইজ নির্বাচন করুন।'
                  : 'Choose a size to continue.'
                : (note ?? lowAtRest)}
            </p>
          </fieldset>
          <div className="absolute top-0 right-0">
            <SizeGuideDrawer
              chart={sizeChart}
              title={title}
              showHelper={sizes.every((size) => isLetterSize(size.label))}
              offered={sizes.map((size) => size.label)}
            />
          </div>
        </div>
      ) : sizeChart !== null ? (
        <div className="relative flex flex-col gap-2 border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="type-eyebrow text-fg">{isBn ? 'সাইজ' : 'Size'}</span>
            <SizeGuideDrawer chart={sizeChart} title={title} showHelper={false} offered={[]} />
          </div>
          <p className="type-small text-fg-muted">
            {isBn
              ? 'এই পোশাকের জন্য সাইজের অপশন আপডেট করা হচ্ছে। অনুগ্রহ করে একটু পরে আবার দেখুন অথবা সাইজ গাইড দেখুন।'
              : 'Size options are being updated for this piece. Please check back shortly or consult the size guide.'}
          </p>
        </div>
      ) : null}

      <div ref={buttonRef} className="flex flex-col gap-3">
        <div className="flex min-w-0 items-stretch gap-2">
          <div
            role="group"
            aria-label="Quantity"
            className="flex shrink-0 items-center border border-line-strong"
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={shownQuantity <= 1 || reason === 'sizes-pending'}
              onClick={() => setQuantity(Math.max(1, shownQuantity - 1))}
              className="touch-target inline-flex size-10 items-center justify-center disabled:opacity-40"
            >
              <Icon icon={Minus} size={16} />
            </button>
            <output aria-live="polite" className="w-7 text-center tabular-nums">
              {isBn ? toBengaliDigits(shownQuantity) : shownQuantity}
            </output>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={shownQuantity >= Math.max(1, limit) || reason === 'sizes-pending'}
              onClick={() => setQuantity(Math.min(Math.max(1, limit), shownQuantity + 1))}
              className="touch-target inline-flex size-10 items-center justify-center disabled:opacity-40"
            >
              <Icon icon={Plus} size={16} />
            </button>
          </div>
          <Button
            size="lg"
            variant="secondary"
            fullWidth
            className="min-w-0 flex-1 border border-line-strong px-3 hover:border-fg"
            loading={pending}
            disabled={reason === 'sold-out' || reason === 'sizes-pending' || buyNowPending}
            onClick={add}
          >
            {buttonLabel}
          </Button>
          <WishlistButton
            productId={productId}
            title={title}
            className="aspect-square h-12 w-12 shrink-0 border border-line-strong bg-transparent"
          />
        </div>

        {/* High-conversion Express Buy Now button */}
        {reason !== 'sold-out' && reason !== 'sizes-pending' ? (
          <Button
            size="lg"
            variant="primary"
            fullWidth
            loading={buyNowPending}
            disabled={pending}
            onClick={buyNow}
            className="w-full tracking-button"
          >
            {reason === 'choose-size'
              ? isBn
                ? 'কিনতে সাইজ নির্বাচন করুন'
                : 'Choose size to buy'
              : isBn
                ? 'এখনই কিনুন — ইনস্ট্যান্ট চেকআউট'
                : 'Buy Now — Instant Checkout'}
          </Button>
        ) : null}

        {reason === 'sold-out' ? (
          <Button
            variant="secondary"
            onClick={() =>
              toast.message(
                isBn ? 'স্টক এলার্ট শীঘ্রই চালু হচ্ছে' : 'Back-in-stock alerts are coming soon',
                isBn
                  ? 'আপাতত আমাদের কনসিয়ার্জ ডেস্ক আপনাকে এই পোশাক ফিরে আসার তথ্য জানাতে পারবে।'
                  : 'For now, our concierge can tell you when this piece returns.',
              )
            }
          >
            {isBn ? 'স্টক আসলে জানান' : 'Notify me'}
          </Button>
        ) : null}

        {/* Reassurance perks */}
        <div className="mt-1 flex flex-col gap-1.5 rounded-xs border border-line/60 bg-sunken/40 p-3.5 type-small text-fg-muted">
          <div className="flex items-center gap-2 text-fg">
            <span className="font-bold text-accent-text">✓</span>
            <span>
              {isBn
                ? '৬৪ জেলায় ক্যাশ অন ডেলিভারি সুবিধা'
                : 'Cash on delivery available across all 64 districts'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-fg">
            <span className="font-bold text-accent-text">✓</span>
            <span>
              {isBn
                ? 'ডেলিভারির আগে ফোন করে সাইজ নিশ্চিতকরণ'
                : 'Personal fitting verification call before dispatch'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-fg">
            <span className="font-bold text-accent-text">✓</span>
            <span>
              {isBn ? '৭ দিনের মধ্যে সহজ সাইজ এক্সচেঞ্জ' : 'Doorstep size exchange within 7 days'}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile sticky bar: shown once the main button has scrolled away. */}
      <div
        aria-hidden={!barVisible}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-page/98 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-float backdrop-blur-md transition-transform duration-(--dur-base) ease-auren motion-reduce:transition-none md:hidden',
          barVisible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
      >
        {/* Compact Size Chips on Mobile if not yet selected */}
        {sizes.length > 0 && !chosen ? (
          <div className="mb-2 scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="shrink-0 type-caption font-mono tracking-wider text-gold uppercase">
              {isBn ? 'সাইজ:' : 'Size:'}
            </span>
            {options.map((option) => {
              const isSelected = option.sizeId === sizeId;
              const disabled = option.state === 'out' || option.available <= 0;
              return (
                <button
                  key={option.sizeId}
                  type="button"
                  disabled={disabled}
                  tabIndex={barVisible ? 0 : -1}
                  onClick={() => setSizeId(option.sizeId)}
                  className={cn(
                    'inline-flex h-7 min-w-7 items-center justify-center rounded-xs border px-2 type-caption font-mono font-medium transition-all duration-150',
                    isSelected
                      ? 'shadow-xs border-gold bg-gold font-semibold text-ink'
                      : 'border-line-strong bg-raised/80 text-fg hover:border-gold',
                    disabled && 'border-line line-through opacity-35',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate type-small font-medium text-fg">{title}</p>
            <div className="flex items-center gap-1.5 type-small text-fg-muted">
              <span className="truncate">
                {[color?.label, chosen?.label].filter(Boolean).join(' · ') ||
                  (isBn ? 'সাইজ নির্বাচন করুন' : 'Select a size')}
              </span>
              {chosen && liveVariant ? (
                <>
                  <span aria-hidden="true">·</span>
                  <Price
                    size="sm"
                    price={deserialize(liveVariant.price)}
                    compareAt={liveVariant.compareAt ? deserialize(liveVariant.compareAt) : null}
                  />
                </>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            disabled={reason === 'sold-out' || reason === 'sizes-pending' || buyNowPending}
            tabIndex={barVisible ? 0 : -1}
            onClick={() => {
              if (reason === 'choose-size') {
                document.getElementById('size-group')?.scrollIntoView({ block: 'center' });
              }
              add();
            }}
            className="shrink-0 tracking-button"
          >
            {isBn ? 'ব্যাগে নিন' : 'Add'}
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={buyNowPending}
            disabled={reason === 'sold-out' || reason === 'sizes-pending' || pending}
            tabIndex={barVisible ? 0 : -1}
            onClick={() => {
              if (reason === 'choose-size') {
                document.getElementById('size-group')?.scrollIntoView({ block: 'center' });
              }
              buyNow();
            }}
            className="shrink-0 tracking-button"
          >
            {isBn ? 'এখনই কিনুন' : 'Buy Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
