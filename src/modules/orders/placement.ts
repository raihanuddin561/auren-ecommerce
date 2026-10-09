import type { Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import * as catalog from '@/modules/catalog/service';
import type { SellableVariant } from '@/modules/catalog/service';
import * as inventory from '@/modules/inventory/service';

/**
 * The rules every way of putting items on an order shares (web checkout, manual entry, editing an
 * order during verification): prices and costs are read from the database inside the transaction,
 * the variant must be sellable and have a cost basis, and stock must be there (INV-M3, INV-O5).
 */

export interface RequestedLine {
  variantId: string;
  quantity: number;
}

export interface ResolvedLine {
  variant: SellableVariant;
  quantity: number;
}

export const lineLabel = (variant: { productTitle: string; optionsLabel: string }) =>
  variant.optionsLabel ? `${variant.productTitle} (${variant.optionsLabel})` : variant.productTitle;

export interface ResolveOptions {
  /** The order currency; a variant in another currency cannot be on the order. */
  currency: string;
  /** Check free stock for the whole quantity. Editing an order checks only the extra units instead. */
  checkAvailability?: boolean;
  /** Receives variants refused for lack of a cost basis (checkout reports them after it rolls back). */
  onNoCost?: (variantId: string) => void;
}

/** Locks the variants, reads them and refuses what cannot be sold. Call inside a transaction. */
export async function resolveLines(
  tx: Tx,
  requested: readonly RequestedLine[],
  options: ResolveOptions,
): Promise<ResolvedLine[]> {
  const ids = requested.map((line) => line.variantId);
  // Lock the variants, then read them: price and cost cannot change under us (INV-M3, INV-O5).
  await catalog.lockVariantCosts(tx, ids);
  const variants = await catalog.getSellableVariants(tx, ids);
  const availability =
    options.checkAvailability === false ? null : await inventory.getAvailability(ids, tx);
  return requested.map((line) => {
    const variant = variants.get(line.variantId);
    if (!variant?.sellable || variant.currency !== options.currency) {
      throw new DomainError(
        'CONFLICT',
        `${variant ? lineLabel(variant) : 'An item in your bag'} is no longer available. Please remove it from your bag and try again.`,
      );
    }
    if (variant.avgCostMinor <= 0n) {
      // No cost basis: profit could not be recorded. Purchasing must receive stock first.
      logger.warn({ variantId: variant.id }, 'order refused: variant has no cost basis');
      options.onNoCost?.(variant.id);
      throw new DomainError(
        'CONFLICT',
        `${lineLabel(variant)} cannot be ordered online right now. Please message our concierge.`,
      );
    }
    if (availability) {
      const available = availability.get(line.variantId)?.available ?? 0;
      if (available < line.quantity) {
        throw new DomainError(
          'OUT_OF_STOCK',
          available <= 0
            ? `${lineLabel(variant)} has just sold out. Please remove it from your bag and try again.`
            : `${lineLabel(variant)} has only ${available} left. Please lower the quantity and try again.`,
        );
      }
    }
    return { variant, quantity: line.quantity };
  });
}
