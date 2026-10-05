import {
  compare,
  money,
  multiply,
  serialize,
  subtract,
  sum,
  type Money,
  type SerializedMoney,
} from '@/lib/money';
import { MAX_LINE_QUANTITY } from './schemas';

/**
 * What the browser is told about the bag. Everything here is computed on the server from database
 * rows (INV-M3); the browser only ever sends variant ids and quantities back.
 */

export type LineIssue = 'unavailable' | 'sold_out' | 'short';

export interface CartLineView {
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  optionsLabel: string;
  image: { url: string; alt: string } | null;
  quantity: number;
  unitPrice: SerializedMoney;
  compareAt: SerializedMoney | null;
  lineTotal: SerializedMoney;
  /** Most the shopper can hold of this line now: stock and the per-line cap. */
  maxQuantity: number;
  /** Set when the line cannot be bought as it stands; checkout stays closed until it is fixed. */
  issue: LineIssue | null;
}

export interface FreeDeliveryView {
  threshold: SerializedMoney | null;
  /** How much more to add for free delivery; null when there is no threshold or it is reached. */
  remaining: SerializedMoney | null;
  reached: boolean;
}

export interface CartView {
  /** Changes whenever the bag does; the browser keeps whichever view is newest. */
  revision: string;
  /** Units in the bag (the number on the header bag). */
  count: number;
  lines: CartLineView[];
  subtotal: SerializedMoney;
  currency: string;
  freeDelivery: FreeDeliveryView;
  hasIssues: boolean;
}

export interface ViewLineInput {
  variantId: string;
  quantity: number;
  variant: {
    productId: string;
    productTitle: string;
    productSlug: string;
    optionsLabel: string;
    priceMinor: bigint;
    compareAtMinor: bigint | null;
    currency: string;
    image: { url: string; alt: string } | null;
    sellable: boolean;
  } | null;
  available: number;
}

/**
 * A bag with nothing in it. A bag that exists keeps its own revision, so emptying it is newer than
 * the full bag the browser holds; a visitor with no bag at all is revision 0.
 */
export function emptyCartView(
  currency: string,
  threshold: Money | null,
  revision = '0:0',
): CartView {
  return buildCartView({ currency, revision, lines: [], threshold });
}

export function buildCartView(input: {
  currency: string;
  revision: string;
  lines: readonly ViewLineInput[];
  threshold: Money | null;
}): CartView {
  const { currency } = input;
  const lines: CartLineView[] = [];
  const totals: Money[] = [];
  let count = 0;

  for (const line of input.lines) {
    const v = line.variant;
    // A variant that was removed or unpublished stays visible so the shopper can take it out.
    if (!v) continue;
    const unit = money(v.priceMinor, v.currency);
    const total = multiply(unit, line.quantity);
    const maxQuantity = Math.max(0, Math.min(line.available, MAX_LINE_QUANTITY));
    const issue: LineIssue | null =
      !v.sellable || v.currency !== currency
        ? 'unavailable'
        : line.available <= 0
          ? 'sold_out'
          : line.quantity > line.available
            ? 'short'
            : null;
    // Only lines that can be bought count toward the total the shopper will pay.
    if (issue === null) totals.push(total);
    count += line.quantity;
    lines.push({
      variantId: line.variantId,
      productId: v.productId,
      productTitle: v.productTitle,
      productSlug: v.productSlug,
      optionsLabel: v.optionsLabel,
      image: v.image,
      quantity: line.quantity,
      unitPrice: serialize(unit),
      compareAt: v.compareAtMinor === null ? null : serialize(money(v.compareAtMinor, v.currency)),
      lineTotal: serialize(total),
      maxQuantity,
      issue,
    });
  }

  const subtotal = sum(totals, currency);
  const { threshold } = input;
  const reached = threshold !== null && compare(subtotal, threshold) >= 0;
  return {
    revision: input.revision,
    count,
    lines,
    subtotal: serialize(subtotal),
    currency,
    freeDelivery: {
      threshold: threshold ? serialize(threshold) : null,
      remaining: threshold && !reached ? serialize(subtract(threshold, subtotal)) : null,
      reached,
    },
    hasIssues: lines.some((line) => line.issue !== null),
  };
}
