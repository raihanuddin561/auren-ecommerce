'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import type { CardColor, CardImage, CardVariant } from '@/modules/catalog/card';
import { addToBag } from '../cart/cart-client';
import { CatalogImage, ImagePlaceholder, isLocalImage } from './catalog-image';

/**
 * The interactive parts of a product card. The card itself is a Server Component; these small
 * client pieces share one piece of state, the chosen colour, through a provider that wraps the
 * server-rendered children.
 */

interface CardStateValue {
  colors: CardColor[];
  variants: CardVariant[];
  sizes: string[];
  /** The colour shown now: a hovered or focused swatch, else the chosen one. */
  activeColorId: string | null;
  selectedColorId: string | null;
  preview: (id: string | null) => void;
  select: (id: string) => void;
}

const CardStateContext = createContext<CardStateValue | null>(null);

function useCardState(): CardStateValue {
  const value = useContext(CardStateContext);
  if (!value) throw new Error('Card parts must be inside <CardState>');
  return value;
}

interface CardStateProps {
  colors: CardColor[];
  variants: CardVariant[];
  sizes: string[];
  children: ReactNode;
}

export function CardState({ colors, variants, sizes, children }: CardStateProps) {
  const [selected, setSelected] = useState<string | null>(colors[0]?.id ?? null);
  const [previewed, setPreviewed] = useState<string | null>(null);
  const value = useMemo<CardStateValue>(
    () => ({
      colors,
      variants,
      sizes,
      selectedColorId: selected,
      activeColorId: previewed ?? selected,
      preview: setPreviewed,
      select: setSelected,
    }),
    [colors, variants, sizes, selected, previewed],
  );
  return <CardStateContext.Provider value={value}>{children}</CardStateContext.Provider>;
}

// ---------------------------------------------------------------------------------------------
// Pictures
// ---------------------------------------------------------------------------------------------

interface CardImagesProps {
  image: CardImage | null;
  hoverImage: CardImage | null;
  title: string;
  sizes: string;
  priority: boolean;
}

/**
 * The 4:5 picture area (the parent is positioned and fixed in ratio). Shows the chosen colour's
 * picture and, on pointer devices, its second picture on hover or focus. A picture that cannot be
 * loaded becomes a calm stone block that keeps the text description.
 */
export function CardImages({ image, hoverImage, title, sizes, priority }: CardImagesProps) {
  const { colors, activeColorId } = useCardState();
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const markFailed = useCallback(
    (url: string) => setFailed((current) => new Set(current).add(url)),
    [],
  );

  const active = colors.find((color) => color.id === activeColorId) ?? null;
  const main = active?.image ?? image;
  const second = active ? active.hoverImage : hoverImage;
  // The second picture is a convenience, so it is only used when it can be shown the same way.
  const swap =
    main && second && second.url !== main.url && isLocalImage(second.url) && !failed.has(second.url)
      ? second
      : null;

  if (!main) return <ImagePlaceholder label="AUREN" />;
  if (failed.has(main.url)) {
    return (
      <div
        role="img"
        aria-label={main.alt}
        className="absolute inset-0 flex items-end bg-sunken p-4"
      >
        <span aria-hidden="true" className="type-small text-fg-muted">
          {title}
        </span>
      </div>
    );
  }

  return (
    <>
      <CatalogImage
        key={main.url}
        src={main.url}
        alt={main.alt}
        sizes={sizes}
        priority={priority}
        width={main.width}
        height={main.height}
        blurData={main.blurData}
        onError={() => markFailed(main.url)}
        className={swap ? undefined : 'img-zoom'}
      />
      {swap ? (
        // Decorative: the first image already names the product.
        <CatalogImage
          key={swap.url}
          src={swap.url}
          alt=""
          sizes={sizes}
          className="img-swap"
          onError={() => markFailed(swap.url)}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Colour swatches
// ---------------------------------------------------------------------------------------------

/** Swatches shown on a phone (large touch targets need room); the rest are counted. */
const PHONE_SWATCHES = 3;
const WIDE_SWATCHES = 6;

const hexOrNull = (hex: string | null) => (hex && /^#[0-9a-f]{3,8}$/i.test(hex) ? hex : null);

export function ColorSwatches() {
  const { colors, selectedColorId, preview, select } = useCardState();
  if (colors.length < 2) return null;

  return (
    <div
      role="group"
      aria-label="Colours"
      className="relative z-20 -ml-1.5 flex flex-wrap items-center gap-x-1 pt-1"
    >
      {colors.map((color, index) => {
        const pressed = color.id === selectedColorId;
        const fill = hexOrNull(color.hex);
        return (
          <button
            key={color.id}
            type="button"
            aria-label={color.label}
            aria-pressed={pressed}
            title={color.label}
            onMouseEnter={() => preview(color.id)}
            onMouseLeave={() => preview(null)}
            onFocus={() => preview(color.id)}
            onBlur={() => preview(null)}
            onClick={() => select(color.id)}
            className={cn(
              'inline-flex size-11 items-center justify-center sm:size-8',
              index >= PHONE_SWATCHES && 'max-sm:hidden',
              index >= WIDE_SWATCHES && 'hidden',
            )}
          >
            <span
              aria-hidden="true"
              style={fill ? { backgroundColor: fill } : undefined}
              className={cn(
                'block size-5 rounded-full border border-line-strong transition-auren-fast',
                !fill && 'bg-sunken',
                pressed && 'ring-1 ring-fg ring-offset-2 ring-offset-page',
              )}
            />
          </button>
        );
      })}
      {colors.length > PHONE_SWATCHES ? (
        <span className="px-1 type-small text-fg-muted sm:hidden">
          <span aria-hidden="true">+{colors.length - PHONE_SWATCHES}</span>
          <span className="sr-only">{colors.length - PHONE_SWATCHES} more colours</span>
        </span>
      ) : null}
      {colors.length > WIDE_SWATCHES ? (
        <span className="px-1 type-small text-fg-muted max-sm:hidden">
          <span aria-hidden="true">+{colors.length - WIDE_SWATCHES}</span>
          <span className="sr-only">{colors.length - WIDE_SWATCHES} more colours</span>
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Quick add
// ---------------------------------------------------------------------------------------------

interface QuickAddProps {
  title: string;
}

/**
 * Sizes for the chosen colour, shown over the picture on desktop hover or keyboard focus. A size
 * with no stock is struck through and disabled. Choosing one asks the bag action, which re-checks
 * stock on the server and the bag drawer opens on success.
 */
export function QuickAdd({ title }: QuickAddProps) {
  const { variants, sizes, selectedColorId } = useCardState();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Stock is merged in on the server; without it there is nothing honest to offer here.
  const known = variants.length > 0 && variants.every((variant) => variant.available !== null);
  if (!known || sizes.length === 0) return null;

  const variantFor = (size: string) =>
    variants.find(
      (variant) =>
        variant.size === size && (selectedColorId === null || variant.colorId === selectedColorId),
    );

  const add = (size: string, variant: CardVariant) => {
    setPendingId(variant.id);
    startTransition(async () => {
      await addToBag(variant.id, 1);
      setPendingId(null);
    });
  };

  return (
    <div
      role="group"
      aria-label={`Quick add, ${title}`}
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden bg-page/95 px-3 pt-2 pb-3 opacity-0 transition-auren',
        '[@media(hover:hover)_and_(pointer:fine)]:block',
        'group-focus-within:pointer-events-auto group-focus-within:opacity-100',
        'group-hover:pointer-events-auto group-hover:opacity-100',
      )}
    >
      <p className="mb-1 type-eyebrow text-fg-muted">Quick add</p>
      <ul className="flex flex-wrap gap-1">
        {sizes.map((size) => {
          const variant = variantFor(size);
          const available = variant?.available ?? 0;
          const soldOut = !variant || available <= 0;
          return (
            <li key={size}>
              <button
                type="button"
                disabled={soldOut || (isPending && pendingId === variant?.id)}
                aria-label={soldOut ? `${size}, sold out` : `Add size ${size} to bag`}
                onClick={() => variant && add(size, variant)}
                className={cn(
                  'touch-target inline-flex h-9 min-w-9 items-center justify-center border border-line-strong px-2 type-small text-fg transition-auren-fast',
                  'hover:border-fg hover:bg-fg hover:text-page',
                  'disabled:cursor-not-allowed disabled:border-line disabled:text-fg-muted disabled:hover:bg-transparent disabled:hover:text-fg-muted',
                  soldOut && 'line-through',
                )}
              >
                {size}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
