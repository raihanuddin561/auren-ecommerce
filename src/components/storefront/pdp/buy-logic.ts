import {
  sizeState,
  type LiveVariant,
  type PdpColor,
  type PdpSize,
  type PdpVariant,
  type SizeState,
} from '@/modules/catalog/pdp';

/**
 * What the buy box shows, worked out from the cached shell (which variants exist) and the live
 * read (price and units that can be sold now). Pure, so it is easy to test; the browser only
 * chooses colour and size, never availability.
 */

export interface SizeOption {
  sizeId: string;
  label: string;
  variantId: string | null;
  available: number;
  state: SizeState;
}

export const MAX_QUANTITY = 10;

export function resolveVariant(
  variants: readonly PdpVariant[],
  colorId: string | null,
  sizeId: string | null,
): PdpVariant | null {
  return (
    variants.find(
      (variant) =>
        (variant.colorId === colorId || colorId === null) &&
        (variant.sizeId === sizeId || (sizeId === null && variant.sizeId === null)),
    ) ?? null
  );
}

export function sizeOptions(
  sizes: readonly PdpSize[],
  variants: readonly PdpVariant[],
  live: ReadonlyMap<string, LiveVariant>,
  colorId: string | null,
): SizeOption[] {
  return sizes.map((size) => {
    const variant = resolveVariant(variants, colorId, size.id);
    const available = variant ? (live.get(variant.id)?.available ?? 0) : 0;
    return {
      sizeId: size.id,
      label: size.label,
      variantId: variant?.id ?? null,
      available,
      state: sizeState(available),
    };
  });
}

/** A colour with nothing left in any size shows as sold out on its swatch. */
export function colorSoldOut(
  color: PdpColor,
  variants: readonly PdpVariant[],
  live: ReadonlyMap<string, LiveVariant>,
): boolean {
  return variants
    .filter((variant) => variant.colorId === color.id)
    .every((variant) => (live.get(variant.id)?.available ?? 0) <= 0);
}

/** The phrase under the size chips for the chosen size, or null. */
export function stockNote(option: SizeOption | undefined): string | null {
  if (!option) return null;
  if (option.state === 'out') return 'Sold out in this size.';
  if (option.state === 'low') return `Only ${option.available} left.`;
  return null;
}

export function maxQuantity(available: number): number {
  return Math.max(0, Math.min(MAX_QUANTITY, available));
}

export type BlockReason = 'choose-size' | 'sold-out' | null;

/**
 * Why the main button cannot add yet. Availability comes from the resolved variant (colour and
 * size together), so a product without sizes is handled the same way as one with them.
 */
export function blockReason(input: {
  hasSizes: boolean;
  sizeChosen: boolean;
  /** Units of the resolved variant, or null while no variant is resolved. */
  variantAvailable: number | null;
  anyAvailable: boolean;
}): BlockReason {
  if (!input.anyAvailable) return 'sold-out';
  if (input.hasSizes && !input.sizeChosen) return 'choose-size';
  if (input.variantAvailable !== null && input.variantAvailable <= 0) return 'sold-out';
  return null;
}
