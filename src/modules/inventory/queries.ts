import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { inngest } from '@/lib/jobs/client';
import { logger } from '@/lib/logger';
import { format, money } from '@/lib/money';
import * as repo from './repository';
import {
  getAvailability,
  listInStockProductIds,
  releaseExpired,
  type VariantAvailability,
} from './service';
import type { MovementListParams, StockListParams } from './schemas';

export type { VariantAvailability };

/** Live availability for storefront islands. Deliberately uncached; wrap in Suspense at the call site. */
export const getVariantAvailability = (variantIds: readonly string[]) =>
  getAvailability(variantIds);

// Console reads: call them after the staff check (inventory.read).

export interface StockListRow extends Omit<repo.StockRow, 'avgCostMinor'> {
  avgCost: string | null;
}

export async function listStockLevels(params: StockListParams) {
  const { rows, total } = await repo.listStock(db, params);
  return {
    total,
    pageSize: repo.PAGE_SIZE,
    rows: rows.map<StockListRow>(({ avgCostMinor, ...row }) => ({
      ...row,
      avgCost: avgCostMinor > 0n ? format(money(avgCostMinor, row.currency)) : null,
    })),
  };
}

export interface MovementListRow extends Omit<repo.MovementRow, 'unitCostMinor' | 'createdAt'> {
  createdAt: string;
  unitCost: string | null;
}

export async function listStockMovements(params: MovementListParams) {
  const { rows, total } = await repo.listMovements(db, params);
  return {
    total,
    pageSize: repo.PAGE_SIZE,
    label: params.variantId ? await repo.findVariantLabel(db, params.variantId) : null,
    rows: rows.map<MovementListRow>(({ unitCostMinor, createdAt, ...row }) => ({
      ...row,
      createdAt: createdAt.toISOString(),
      unitCost: unitCostMinor === null ? null : format(money(unitCostMinor, 'BDT')),
    })),
  };
}

/** Live: ids of products with at least one variant that can be sold now. Uncached. */
export const getInStockProductIds = async (): Promise<Set<string>> =>
  new Set(await listInStockProductIds());

/**
 * Cron: gives back stock held by reservations past their 15-minute expiry (abandoned online
 * payments). It only touches stock, never orders: an order is cancelled by staff alone (INV-O2).
 */
export const releaseExpiredStock = inngest.createFunction(
  { id: 'release-expired-reservations', triggers: [{ cron: '* * * * *' }] },
  async () => {
    const result = await releaseExpired();
    for (const tag of result.tags) revalidateTag(tag, 'max');
    if (result.released > 0) {
      logger.info({ released: result.released }, 'expired reservations released');
    }
    return { released: result.released };
  },
);

export const inventoryFunctions = [releaseExpiredStock];
