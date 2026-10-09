import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { fromDecimalString, multiply, money, format } from '@/lib/money';
import { audit, recentlyRecorded } from '@/modules/audit/service';
import { requireApproval } from '@/modules/approvals/service';
import * as catalog from '@/modules/catalog/service';
import { averageCostAfterAddition } from '@/modules/purchasing/cost';
import * as repo from './repository';
import {
  ADD_ONLY_REASONS,
  isWriteOffReason,
  type AdjustStockInput,
  type SetCostBasisInput,
} from './schemas';
import { stockTagsFor } from './tags';

/**
 * The only writer of inventory_levels and stock_movements (INV-S4).
 *
 * Ledger semantics (INV-S3). Every change writes exactly one movement, and per variant and
 * location the ledger reconciles with the level:
 *   on_hand  = sum of the quantities of every movement except `reservation` and `release`
 *   reserved = sum of the quantities of `reservation` (+) and `release` (-)
 * Committing a reservation writes a `release` (the hold ends) and a `sale` (the stock leaves), so
 * both sums stay true. `available = on_hand - reserved`, never negative.
 */

export const DEFAULT_RESERVATION_TTL_SECONDS = 15 * 60;
const EXPIRY_BATCH = 500;

/** `available = on_hand - reserved`, never negative (ARCHITECTURE section 5). */
export interface VariantAvailability {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
}

/**
 * Availability for the storefront. A variant with no stock row simply has none: nothing is
 * purchasable until stock has been received or adjusted in. The client never decides this.
 */
export async function getAvailability(
  variantIds: readonly string[],
  client: Tx = db,
): Promise<Map<string, VariantAvailability>> {
  const rows = await repo.sumLevelsByVariant(client, variantIds);
  const result = new Map<string, VariantAvailability>();
  for (const id of variantIds) {
    result.set(id, { variantId: id, onHand: 0, reserved: 0, available: 0 });
  }
  for (const row of rows) {
    result.set(row.variantId, {
      ...row,
      available: Math.max(0, row.onHand - row.reserved),
    });
  }
  return result;
}

async function resolveLocation(tx: Tx, locationId?: string): Promise<string> {
  if (locationId) {
    if (!(await repo.locationIsActive(tx, locationId))) {
      throw new DomainError('NOT_FOUND', 'That location is not available.');
    }
    return locationId;
  }
  const found = await repo.findDefaultLocationId(tx);
  if (!found) throw new DomainError('CONFLICT', 'There is no active stock location.');
  return found;
}

const requirePositive = (quantity: number) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('VALIDATION', 'Quantity must be a whole number above zero.');
  }
};

/** What a stock write touched, so the caller can invalidate the right cache tags. */
export interface StockEffect {
  variantIds: string[];
  tags: string[];
}

/** Resolves product ids and builds the full tag list for a set of variants. */
export async function effectFor(tx: Tx, variantIds: readonly string[]): Promise<StockEffect> {
  const unique = [...new Set(variantIds)];
  const products = await catalog.productIdsForVariants(tx, unique);
  return { variantIds: unique, tags: stockTagsFor(unique, [...new Set(products.values())]) };
}

// ---------------------------------------------------------------------------------------------
// Receipts (called by purchasing with its transaction)
// ---------------------------------------------------------------------------------------------

export interface ReceiveInput {
  variantId: string;
  locationId?: string;
  quantity: number;
  unitCostMinor: bigint;
  referenceType: string;
  referenceId: string;
  actorId?: string;
}

export interface ReceiveResult {
  locationId: string;
  /** Units on hand across every location before and after this receipt. */
  onHandBefore: number;
  onHandAfter: number;
}

/** Adds received stock and writes the receipt movement. */
export async function receive(tx: Tx, input: ReceiveInput): Promise<ReceiveResult> {
  requirePositive(input.quantity);
  if (input.unitCostMinor < 0n) throw new DomainError('VALIDATION', 'Cost cannot be negative.');
  const locationId = await resolveLocation(tx, input.locationId);
  await repo.addOnHand(tx, input.variantId, locationId, input.quantity);
  await repo.insertMovement(tx, {
    variantId: input.variantId,
    locationId,
    type: 'receipt',
    quantity: input.quantity,
    unitCostMinor: input.unitCostMinor,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    actorId: input.actorId ?? null,
  });
  // The cost base covers every location, active or not: the average cost belongs to the variant.
  const onHandAfter = await repo.sumOnHandAllLocations(tx, input.variantId);
  return { locationId, onHandBefore: onHandAfter - input.quantity, onHandAfter };
}

// ---------------------------------------------------------------------------------------------
// Manual adjustments
// ---------------------------------------------------------------------------------------------

export interface StockActor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  /**
   * Asks for the fresh step-up that sets a cost basis (INV-A6). The service calls it when a stock
   * addition would establish the cost of a variant (no cost yet, or nothing on hand), so a cost
   * cannot be set through the Adjust stock door without the confirmation Set cost needs.
   */
  requireSetCostStepUp?: () => Promise<void>;
}

export interface AdjustResult {
  variantId: string;
  locationId: string;
  delta: number;
  onHand: number;
  reserved: number;
}

/**
 * Staff correction with a reason (count, damage, found ...). Returns the new level and the cache
 * tags. Removing stock never touches what is reserved for customers; a large write-down also
 * needs a second approver (maker-checker) when its cost value crosses the configured threshold.
 */
export async function adjustStock(
  input: AdjustStockInput,
  actor: StockActor,
): Promise<{ data: AdjustResult; tags: string[] }> {
  return db.$transaction(async (tx) => {
    const costs = await catalog.lockVariantCosts(tx, [input.variantId]);
    const variant = costs.get(input.variantId);
    if (!variant) throw new DomainError('NOT_FOUND', 'That variant does not exist.');
    const locationId = await resolveLocation(tx, input.locationId);

    const before = (await repo.lockLevel(tx, input.variantId, locationId)) ?? {
      onHand: 0,
      reserved: 0,
    };
    const delta =
      input.change.mode === 'delta' ? input.change.delta : input.change.counted - before.onHand;
    if (delta === 0) throw new DomainError('VALIDATION', 'That is already the quantity on hand.');
    if (ADD_ONLY_REASONS.includes(input.reason) && delta < 0) {
      throw new DomainError('VALIDATION', 'This reason must add units.', {
        fieldErrors: { change: ['This reason must add units.'] },
      });
    }
    if (isWriteOffReason(input.reason) && delta > 0) {
      throw new DomainError('VALIDATION', 'A write-off must remove units.', {
        fieldErrors: { change: ['A write-off must remove units.'] },
      });
    }

    const unitCostMinor =
      input.unitCost === undefined
        ? null
        : fromDecimalString(input.unitCost, variant.currency).minor;
    if (unitCostMinor !== null && delta < 0) {
      throw new DomainError('VALIDATION', 'A unit cost applies only when adding stock.', {
        fieldErrors: { unitCost: ['A unit cost applies only when adding stock.'] },
      });
    }
    if (delta > 0 && unitCostMinor === null && variant.avgCostMinor <= 0n) {
      throw new DomainError('VALIDATION', 'This variant has no cost yet: enter the unit cost.', {
        fieldErrors: { unitCost: ['This variant has no cost yet. Enter what one unit cost you.'] },
      });
    }

    // Units on hand in every location, read before this change: the cost base of the average.
    const onHandBeforeAll = await repo.sumOnHandAllLocations(tx, input.variantId);
    const establishesCost =
      delta > 0 && unitCostMinor !== null && (variant.avgCostMinor <= 0n || onHandBeforeAll <= 0);
    if (establishesCost) {
      if (!actor.requireSetCostStepUp) {
        throw new DomainError('FORBIDDEN', 'Setting a cost needs a fresh confirmation.');
      }
      await actor.requireSetCostStepUp();
    }
    let after: repo.LevelAfter;
    if (delta > 0) {
      after = await repo.addOnHand(tx, input.variantId, locationId, delta);
    } else {
      const removed = await repo.removeFreeOnHand(tx, input.variantId, locationId, -delta);
      if (!removed) {
        throw new DomainError(
          'CONFLICT',
          `Only ${Math.max(0, before.onHand - before.reserved)} units are free; the rest are reserved for customers.`,
          { fieldErrors: { change: ['That would remove stock reserved for customers.'] } },
        );
      }
      after = removed;
    }
    // A large change either way (writing stock off, or conjuring it up) needs a second person.
    const valuationBasis =
      unitCostMinor !== null && unitCostMinor > variant.avgCostMinor
        ? unitCostMinor
        : variant.avgCostMinor;
    // Giving a cost to units already on hand re-values them too, so they count toward the threshold.
    const valuedUnits =
      delta > 0 && unitCostMinor !== null && variant.avgCostMinor <= 0n
        ? delta + onHandBeforeAll
        : Math.abs(delta);
    const value = multiply(money(valuationBasis, variant.currency), valuedUnits);
    await requireApproval(tx, {
      kind: 'stock_adjustment',
      subjectType: 'variant',
      subjectId: input.variantId,
      amountMinor: value.minor,
      currency: variant.currency,
    });

    await repo.insertMovement(tx, {
      variantId: input.variantId,
      locationId,
      type: isWriteOffReason(input.reason) ? 'write_off' : 'adjustment',
      quantity: delta,
      referenceType: 'adjustment',
      unitCostMinor: delta > 0 ? unitCostMinor : null,
      reason: input.note ? `${input.reason}: ${input.note}` : input.reason,
      actorId: actor.userId,
    });
    // Same weighted average (and rounding) as a goods receipt; removals never change the cost.
    let avgCostAfter = variant.avgCostMinor;
    if (delta > 0 && unitCostMinor !== null) {
      avgCostAfter = averageCostAfterAddition({
        onHandBefore: onHandBeforeAll,
        avgCostBeforeMinor: variant.avgCostMinor,
        addedQuantity: delta,
        unitCostMinor,
      });
      await catalog.setVariantAverageCost(tx, input.variantId, avgCostAfter);
    }
    await audit(tx, {
      actorId: actor.userId,
      action: 'stock.adjust',
      entity: 'variant',
      entityId: input.variantId,
      before: {
        onHand: before.onHand,
        reserved: before.reserved,
        avgCostMinor: variant.avgCostMinor.toString(),
      },
      after: {
        onHand: after.onHand,
        reserved: after.reserved,
        reason: input.reason,
        delta,
        avgCostMinor: avgCostAfter.toString(),
        ...(unitCostMinor !== null ? { unitCostMinor: unitCostMinor.toString() } : {}),
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    const effect = await effectFor(tx, [input.variantId]);
    return {
      data: {
        variantId: input.variantId,
        locationId,
        delta,
        onHand: after.onHand,
        reserved: after.reserved,
      },
      tags: effect.tags,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Reserve, commit, release (checkout and orders call these with their own transaction)
// ---------------------------------------------------------------------------------------------

export interface StockLine {
  variantId: string;
  quantity: number;
}

export interface ReserveInput {
  referenceType: string;
  referenceId: string;
  lines: readonly StockLine[];
  ttlSeconds?: number;
  actorId?: string;
}

/** Lines in a stable order, merged per variant, so parallel buyers lock rows the same way. */
function normaliseLines(lines: readonly StockLine[]): StockLine[] {
  const merged = new Map<string, number>();
  for (const line of lines) {
    requirePositive(line.quantity);
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  }
  if (merged.size === 0) throw new DomainError('VALIDATION', 'There is nothing to reserve.');
  return [...merged.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Holds stock with one conditional UPDATE per line (INV-S2): when free stock is short the update
 * touches no row and the whole call fails with OUT_OF_STOCK, so the caller's transaction rolls the
 * other lines back. Calling it again for the same reference is a no-op (idempotent).
 */
export async function reserve(tx: Tx, input: ReserveInput): Promise<StockEffect> {
  const locationId = await resolveLocation(tx);
  const ttl = input.ttlSeconds ?? DEFAULT_RESERVATION_TTL_SECONDS;
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 24 * 3600) {
    throw new DomainError('VALIDATION', 'A reservation must last between one minute and one day.');
  }
  const touched: string[] = [];
  for (const line of normaliseLines(input.lines)) {
    const inserted = await repo.insertReservationIfAbsent(tx, {
      variantId: line.variantId,
      locationId,
      quantity: line.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      ttlSeconds: ttl,
    });
    if (!inserted) {
      const existing = await repo.findReservation(
        tx,
        input.referenceType,
        input.referenceId,
        line.variantId,
      );
      if (existing?.status !== 'active' || existing.quantity !== line.quantity) {
        throw new DomainError('CONFLICT', 'This reference already holds a different reservation.');
      }
      continue;
    }
    const level = await repo.holdStock(tx, line.variantId, locationId, line.quantity);
    if (!level) throw new DomainError('OUT_OF_STOCK', 'That item is no longer available.');
    await repo.insertMovement(tx, {
      variantId: line.variantId,
      locationId,
      type: 'reservation',
      quantity: line.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      actorId: input.actorId ?? null,
    });
    touched.push(line.variantId);
  }
  return effectFor(tx, touched);
}

export interface ReservationRef {
  referenceType: string;
  referenceId: string;
  actorId?: string;
}

/**
 * Converts the reservations of a reference into sales. The caller names the lines it expects to
 * sell: a line whose hold is gone (expired and released, or never made) fails the call with
 * CONFLICT instead of quietly selling stock that is no longer held. A line already committed for
 * this reference is a replay and is skipped, so the call is idempotent.
 */
export async function commitReservation(
  tx: Tx,
  input: ReservationRef & { lines: readonly StockLine[] },
): Promise<StockEffect> {
  const open = await repo.lockActiveReservations(tx, input.referenceType, input.referenceId);
  for (const line of normaliseLines(input.lines)) {
    if (open.some((r) => r.variantId === line.variantId && r.quantity === line.quantity)) continue;
    const settled = await repo.findReservation(
      tx,
      input.referenceType,
      input.referenceId,
      line.variantId,
    );
    if (settled?.status === 'committed' && settled.quantity === line.quantity) continue;
    throw new DomainError('CONFLICT', 'The stock held for this order is no longer reserved.');
  }
  for (const reservation of open) {
    const level = await repo.consumeHeldStock(
      tx,
      reservation.variantId,
      reservation.locationId,
      reservation.quantity,
    );
    if (!level) throw new DomainError('CONFLICT', 'The reserved stock is no longer held.');
    const base = {
      variantId: reservation.variantId,
      locationId: reservation.locationId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      actorId: input.actorId ?? null,
    };
    await repo.insertMovement(tx, {
      ...base,
      type: 'release',
      quantity: -reservation.quantity,
      reason: 'committed',
    });
    await repo.insertMovement(tx, { ...base, type: 'sale', quantity: -reservation.quantity });
    await repo.resolveReservation(tx, reservation.id, 'committed');
  }
  return effectFor(
    tx,
    open.map((r) => r.variantId),
  );
}

/** Gives the open reservations of a reference back (cancel, expiry by staff, failed payment). */
export async function releaseReservation(
  tx: Tx,
  input: ReservationRef & { reason?: string },
): Promise<StockEffect> {
  const open = await repo.lockActiveReservations(tx, input.referenceType, input.referenceId);
  for (const reservation of open) {
    const level = await repo.unholdStock(
      tx,
      reservation.variantId,
      reservation.locationId,
      reservation.quantity,
    );
    if (!level) throw new DomainError('CONFLICT', 'The reserved stock is no longer held.');
    await repo.insertMovement(tx, {
      variantId: reservation.variantId,
      locationId: reservation.locationId,
      type: 'release',
      quantity: -reservation.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      reason: input.reason ?? 'released',
      actorId: input.actorId ?? null,
    });
    await repo.resolveReservation(tx, reservation.id, 'released');
  }
  return effectFor(
    tx,
    open.map((r) => r.variantId),
  );
}

export interface SellInput {
  referenceType: string;
  referenceId: string;
  lines: readonly StockLine[];
  actorId?: string;
}

/**
 * Sells straight from free stock (cash on delivery and manual orders hold stock from the moment
 * the order is placed). Same conditional update as a reservation: short stock fails the call.
 */
export async function sell(tx: Tx, input: SellInput): Promise<StockEffect> {
  const locationId = await resolveLocation(tx);
  const touched: string[] = [];
  for (const line of normaliseLines(input.lines)) {
    const level = await repo.removeFreeOnHand(tx, line.variantId, locationId, line.quantity);
    if (!level) throw new DomainError('OUT_OF_STOCK', 'That item is no longer available.');
    await repo.insertMovement(tx, {
      variantId: line.variantId,
      locationId,
      type: 'sale',
      quantity: -line.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      actorId: input.actorId ?? null,
    });
    touched.push(line.variantId);
  }
  return effectFor(tx, touched);
}

export interface RestockInput {
  referenceType: string;
  referenceId: string;
  lines: readonly StockLine[];
  reason?: string;
  actorId?: string;
}

/**
 * Returns sold units back to stock (e.g. cancelled order before fulfillment).
 * Increments on_hand and records a 'return_restock' movement with positive quantity.
 */
export async function restock(tx: Tx, input: RestockInput): Promise<StockEffect> {
  const locationId = await resolveLocation(tx);
  const touched: string[] = [];
  for (const line of normaliseLines(input.lines)) {
    await repo.addOnHand(tx, line.variantId, locationId, line.quantity);
    await repo.insertMovement(tx, {
      variantId: line.variantId,
      locationId,
      type: 'return_restock',
      quantity: line.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      reason: input.reason ?? 'order_cancelled',
      actorId: input.actorId ?? null,
    });
    touched.push(line.variantId);
  }
  return effectFor(tx, touched);
}

export interface ReturnLine {
  variantId: string;
  quantity: number;
  /** Fit to sell again, or damaged. */
  condition: 'resellable' | 'damaged';
}

/**
 * Takes returned goods back after inspection (6.12). Every unit comes back as a restock movement;
 * a damaged unit is written off straight away with its own write-off movement, so the ledger shows
 * both the return and the loss and on hand only grows by what can be sold. Both movements carry
 * the return as their reference.
 */
export async function restockReturn(
  tx: Tx,
  input: { returnId: string; lines: readonly ReturnLine[]; actorId?: string },
): Promise<StockEffect> {
  const locationId = await resolveLocation(tx);
  const touched: string[] = [];
  for (const line of input.lines) {
    requirePositive(line.quantity);
    await repo.addOnHand(tx, line.variantId, locationId, line.quantity);
    await repo.insertMovement(tx, {
      variantId: line.variantId,
      locationId,
      type: 'return_restock',
      quantity: line.quantity,
      referenceType: 'return',
      referenceId: input.returnId,
      reason: line.condition === 'resellable' ? 'return_resellable' : 'return_damaged',
      actorId: input.actorId ?? null,
    });
    if (line.condition === 'damaged') {
      const removed = await repo.removeFreeOnHand(tx, line.variantId, locationId, line.quantity);
      if (!removed)
        throw new DomainError('CONFLICT', 'The returned stock could not be written off.');
      await repo.insertMovement(tx, {
        variantId: line.variantId,
        locationId,
        type: 'write_off',
        quantity: -line.quantity,
        referenceType: 'return',
        referenceId: input.returnId,
        reason: 'return_damaged',
        actorId: input.actorId ?? null,
      });
    }
    touched.push(line.variantId);
  }
  return effectFor(tx, touched);
}

/** Units this reference still holds as sold, per variant (sales minus put-backs). */
export const netSoldStock = (tx: Tx, referenceType: string, referenceId: string) =>
  repo.netSoldByVariant(tx, referenceType, referenceId);

export const hasSoldStock = (tx: Tx, referenceType: string, referenceId: string) =>
  repo.hasSaleMovements(tx, referenceType, referenceId);

export const hasRestockedStock = (tx: Tx, referenceType: string, referenceId: string) =>
  repo.hasRestockMovements(tx, referenceType, referenceId);

/**
 * Releases every reservation past its expiry (cron). Safe to run twice and from two workers at
 * once. It never touches orders: an order is only ever cancelled by staff (INV-O2).
 */
export async function releaseExpired(
  limit = EXPIRY_BATCH,
): Promise<StockEffect & { released: number }> {
  return db.$transaction(async (tx) => {
    const released = await repo.releaseExpiredReservations(tx, limit);
    const effect = await effectFor(
      tx,
      released.map((row) => row.variantId),
    );
    return { ...effect, released: released.length };
  });
}

// ---------------------------------------------------------------------------------------------
// Cost basis for variants that have none
// ---------------------------------------------------------------------------------------------

export interface CostBasisPreviewRow {
  variantId: string;
  label: string;
  sku: string;
  onHand: number;
  hasCost: boolean;
}

/** The variants of a product with the ones a "set cost" would change (no cost yet) marked. */
export async function previewProductCost(productId: string): Promise<CostBasisPreviewRow[]> {
  const ids = await catalog.liveVariantIdsOfProduct(db, productId);
  if (ids.length === 0) return [];
  const [costs, labels, stock] = await Promise.all([
    catalog.readVariantCosts(db, ids),
    catalog.variantLabels(db, ids),
    getAvailability(ids),
  ]);
  return ids.flatMap((variantId) => {
    const cost = costs.get(variantId);
    if (!cost) return [];
    const label = labels.get(variantId);
    return [
      {
        variantId,
        label: label?.optionsLabel || label?.productTitle || variantId,
        sku: label?.sku ?? '',
        onHand: stock.get(variantId)?.onHand ?? 0,
        hasCost: cost.avgCostMinor > 0n,
      },
    ];
  });
}

export interface SetCostResult {
  updated: number;
  skipped: number;
  tags: string[];
}

/**
 * Gives variants that have no cost a cost basis. It never touches a variant that already has one:
 * an existing average changes only through goods receipts and stock additions, so the cost history
 * stays true. One variant that already has a cost is refused; for a whole product those are skipped.
 */
export async function setCostBasis(
  input: SetCostBasisInput,
  actor: StockActor,
): Promise<SetCostResult> {
  return db.$transaction(async (tx) => {
    const ids =
      input.scope.kind === 'variant'
        ? [input.scope.variantId]
        : await catalog.liveVariantIdsOfProduct(tx, input.scope.productId);
    if (ids.length === 0) throw new DomainError('NOT_FOUND', 'There is nothing to set a cost on.');
    const costs = await catalog.lockVariantCosts(tx, ids);
    if (input.scope.kind === 'variant' && !costs.has(input.scope.variantId)) {
      throw new DomainError('NOT_FOUND', 'That variant does not exist.');
    }
    const changed: string[] = [];
    let skipped = 0;
    for (const id of [...costs.keys()].sort()) {
      const variant = costs.get(id);
      if (!variant) continue;
      if (variant.avgCostMinor > 0n) {
        skipped += 1;
        continue;
      }
      const unitCost = fromDecimalString(input.unitCost, variant.currency).minor;
      // Stock already on hand is re-valued by this cost: a large re-valuation needs a second person.
      const onHandNow = await repo.sumOnHandAllLocations(tx, id);
      await requireApproval(tx, {
        kind: 'stock_adjustment',
        subjectType: 'variant',
        subjectId: id,
        amountMinor: multiply(money(unitCost, variant.currency), onHandNow).minor,
        currency: variant.currency,
      });
      if (!(await catalog.setVariantCostIfUnset(tx, id, unitCost))) {
        skipped += 1;
        continue;
      }
      changed.push(id);
      await audit(tx, {
        actorId: actor.userId,
        action: 'stock.set_cost',
        entity: 'variant',
        entityId: id,
        before: { avgCostMinor: '0' },
        after: {
          avgCostMinor: unitCost.toString(),
          cost: format(money(unitCost, variant.currency)),
        },
        ip: actor.ip ?? null,
        userAgent: actor.userAgent ?? null,
      });
    }
    if (changed.length === 0) {
      throw new DomainError(
        'CONFLICT',
        input.scope.kind === 'variant'
          ? 'This variant already has a cost. Its cost changes through purchase receipts and stock additions.'
          : 'Every variant of this product already has a cost.',
      );
    }
    const effect = await effectFor(tx, changed);
    return { updated: changed.length, skipped, tags: effect.tags };
  });
}

const NO_COST_ALERT_ACTION = 'checkout.no_cost_refused';
const NO_COST_ALERT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Tells staff that a customer tried to order a variant without a cost basis: one audit row per
 * variant and hour, so the audit trail shows what is losing sales without flooding it. Runs outside
 * the (rolled back) checkout transaction and never throws into the customer's request.
 */
export async function reportNoCostRefusal(variantIds: readonly string[]): Promise<void> {
  try {
    for (const variantId of new Set(variantIds)) {
      await db.$transaction(async (tx) => {
        const recent = await recentlyRecorded(
          tx,
          'variant',
          variantId,
          NO_COST_ALERT_ACTION,
          NO_COST_ALERT_WINDOW_MS,
        );
        if (recent) return;
        await audit(tx, {
          actorId: null,
          action: NO_COST_ALERT_ACTION,
          entity: 'variant',
          entityId: variantId,
          after: { reason: 'no_cost_basis' },
        });
      });
    }
  } catch (error) {
    logger.warn({ err: error }, 'could not record a no-cost order refusal');
  }
}

/** Variants that cannot be ordered because they have no cost (live products, not archived). */
export const countVariantsWithoutCost = (): Promise<number> => repo.countVariantsWithoutCost(db);

// ---------------------------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------------------------

/** Levels whose ledger disagrees with them. Empty is the only healthy answer (INV-S3). */
export const findLedgerMismatches = (variantId?: string) =>
  repo.findLedgerMismatches(db, variantId);

/** Ids of the products that have something to sell right now (storefront "In stock" filter). */
export const listInStockProductIds = (): Promise<string[]> => repo.listInStockProductIds(db);

/** Variants matching a product title or SKU, for pickers (purchase order lines). */
export async function searchVariants(q: string) {
  const { rows } = await repo.listStock(db, { q, status: 'all', page: 1 });
  return rows.map((row) => ({
    variantId: row.variantId,
    label: row.optionsLabel ? `${row.productTitle} / ${row.optionsLabel}` : row.productTitle,
    sku: row.sku,
    onHand: row.onHand,
  }));
}
