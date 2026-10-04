'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Price } from '@/components/ui/price';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { deserialize } from '@/lib/money';
import { addToCart } from '@/modules/cart/actions';
import type { LivePrice, PdpColor, PdpSize, PdpSizeChart, PdpVariant } from '@/modules/catalog/pdp';
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
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();
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
  const reason = blockReason({
    hasSizes: sizes.length > 0,
    sizeChosen: Boolean(chosen),
    variantAvailable: liveVariant ? liveVariant.available : null,
    anyAvailable,
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
      let result: Awaited<ReturnType<typeof addToCart>>;
      try {
        result = await addToCart({ variantId: variant.id, quantity: shownQuantity });
      } catch {
        toast.error('We could not do that just now. Please try again.');
        return;
      }
      const choice = [color?.label, chosen?.label].filter(Boolean).join(', ');
      if (result.ok) {
        if (result.data.persisted) {
          toast.success('Added to your bag', `${title}${choice ? `, ${choice}` : ''}.`);
        } else {
          // The bag itself arrives with the cart; say so rather than pretend.
          toast.message(
            'The bag is coming soon',
            `We have noted ${title}${choice ? `, ${choice}` : ''}. Nothing has been added yet.`,
          );
        }
        return;
      }
      if (result.error.code === 'OUT_OF_STOCK') {
        toast.error(result.error.message ?? 'That size is sold out.');
      } else if (result.error.code === 'RATE_LIMITED') {
        toast.error('Please wait a moment and try again.');
      } else {
        toast.error('We could not do that just now. Please try again.');
      }
    });
  }

  const buttonLabel =
    reason === 'sold-out' ? 'Sold out' : reason === 'choose-size' ? 'Choose a size' : 'Add to bag';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        {priceNode}
        <p className="type-small text-fg-muted">Tax included</p>
      </div>

      {colors.length > 0 ? (
        <fieldset>
          <legend className="type-eyebrow text-fg">
            Colour{' '}
            <span className="ml-2 tracking-normal text-fg-muted normal-case">{color?.label}</span>
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
            <legend className="type-eyebrow text-fg">Size</legend>
            <div
              id="size-group"
              tabIndex={-1}
              role="group"
              aria-label="Choose a size"
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
                    {option.label}
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
              {showChoose && !chosen ? 'Choose a size to continue.' : (note ?? lowAtRest)}
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
              disabled={shownQuantity <= 1}
              onClick={() => setQuantity(Math.max(1, shownQuantity - 1))}
              className="touch-target inline-flex size-10 items-center justify-center disabled:opacity-40"
            >
              <Icon icon={Minus} size={16} />
            </button>
            <output aria-live="polite" className="w-7 text-center tabular-nums">
              {shownQuantity}
            </output>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={shownQuantity >= Math.max(1, limit)}
              onClick={() => setQuantity(Math.min(Math.max(1, limit), shownQuantity + 1))}
              className="touch-target inline-flex size-10 items-center justify-center disabled:opacity-40"
            >
              <Icon icon={Plus} size={16} />
            </button>
          </div>
          <Button
            size="lg"
            fullWidth
            className="min-w-0 flex-1 px-3"
            loading={pending}
            disabled={reason === 'sold-out'}
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
        {reason === 'sold-out' ? (
          <Button
            variant="secondary"
            onClick={() =>
              toast.message(
                'Back-in-stock alerts are coming soon',
                'For now, our concierge can tell you when this piece returns.',
              )
            }
          >
            Notify me
          </Button>
        ) : null}
      </div>

      {/* Mobile sticky bar: shown once the main button has scrolled away. */}
      <div
        aria-hidden={!barVisible}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-(--dur-base) ease-auren motion-reduce:transition-none md:hidden',
          barVisible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate type-small text-fg">{title}</p>
            <p className="type-small text-fg-muted">
              {[color?.label, chosen?.label].filter(Boolean).join(' · ') || 'Choose your size'}
            </p>
          </div>
          <Button
            size="md"
            loading={pending}
            disabled={reason === 'sold-out'}
            tabIndex={barVisible ? 0 : -1}
            onClick={() => {
              if (reason === 'choose-size') {
                document.getElementById('size-group')?.scrollIntoView({ block: 'center' });
              }
              add();
            }}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
