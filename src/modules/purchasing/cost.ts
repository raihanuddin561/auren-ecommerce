import { add, allocate, divideRound, money, multiply, ratio, zero, type Money } from '@/lib/money';

/**
 * Pure cost maths for purchasing (INV-F2, INV-F3). Everything is integer minor units through
 * lib/money; nothing here touches the database.
 */

export type AllocationMethod = 'by_quantity' | 'by_value';

export interface CostLine {
  /** purchase_order_items.id */
  id: string;
  quantityOrdered: number;
  unitCostMinor: bigint;
}

export interface LandedCostInput {
  amountMinor: bigint;
  method: AllocationMethod;
}

export interface LandedAllocation {
  /** Landed cost assigned to each line for the whole order (not per unit). */
  perLine: Map<string, bigint>;
  /** Sum over all lines; always equals the sum of the landed costs (INV-F3). */
  total: bigint;
}

/**
 * Spreads every landed cost (freight, duty ...) over the order lines, by quantity or by value
 * (quantity x unit cost), with the largest remainder method so each cost is allocated exactly:
 * the allocations of one cost always add up to that cost.
 */
export function allocateLandedCosts(
  lines: readonly CostLine[],
  costs: readonly LandedCostInput[],
  currency: string,
): LandedAllocation {
  const perLine = new Map<string, bigint>(lines.map((line) => [line.id, 0n]));
  let total = 0n;
  if (lines.length === 0) {
    if (costs.some((cost) => cost.amountMinor > 0n)) {
      throw new Error('Landed costs need at least one line to be spread over.');
    }
    return { perLine, total };
  }
  for (const cost of costs) {
    if (cost.amountMinor === 0n) continue;
    const weights = lines.map((line) =>
      cost.method === 'by_quantity'
        ? BigInt(line.quantityOrdered)
        : BigInt(line.quantityOrdered) * line.unitCostMinor,
    );
    if (weights.every((weight) => weight === 0n)) {
      throw new Error('This cost cannot be spread by value: every line has a zero value.');
    }
    const shares = allocate(money(cost.amountMinor, currency), weights);
    shares.forEach((share, index) => {
      const line = lines[index];
      if (!line) return;
      perLine.set(line.id, (perLine.get(line.id) ?? 0n) + share.minor);
    });
    total += cost.amountMinor;
  }
  return { perLine, total };
}

/**
 * Landed cost that belongs to one delivery of a line. Cumulative and floored: after `receivedAfter`
 * of `quantityOrdered` units the line has carried floor(lineLanded x receivedAfter / ordered); each
 * delivery takes the difference to what earlier deliveries already carried, so the final delivery
 * lands the exact remainder and the deliveries of a line add up to the line's landed cost.
 */
export function receiptLandedShare(input: {
  lineLandedMinor: bigint;
  quantityOrdered: number;
  receivedAfter: number;
  alreadyAllocatedMinor: bigint;
  currency: string;
}): bigint {
  const cumulative = ratio(
    money(input.lineLandedMinor, input.currency),
    input.receivedAfter,
    input.quantityOrdered,
    'down',
  ).minor;
  const share = cumulative - input.alreadyAllocatedMinor;
  if (share < 0n) throw new Error('A delivery cannot carry a negative landed cost.');
  return share;
}

export interface ReceiptValue {
  /** Quantity delivered. */
  quantity: number;
  /** Supplier price per unit. */
  unitCostMinor: bigint;
  /** Landed costs carried by this delivery (total, not per unit). */
  landedMinor: bigint;
}

/** Total landed value of a delivery: goods plus its share of freight, duty and fees. */
export function receiptValue(input: ReceiptValue, currency: string): Money {
  return add(
    multiply(money(input.unitCostMinor, currency), input.quantity),
    money(input.landedMinor, currency),
  );
}

/** Landed cost per unit of a delivery, rounded half to even (shown on the movement). */
export function landedUnitCost(input: ReceiptValue, currency: string): bigint {
  if (input.quantity <= 0) return zero(currency).minor;
  return divideRound(receiptValue(input, currency).minor, BigInt(input.quantity), 'half-even');
}

/**
 * Weighted average cost after a receipt (ARCHITECTURE section 7.2):
 *
 *   new_avg = (on_hand x old_avg + received_qty x landed_unit_cost) / (on_hand + received_qty)
 *
 * `received_qty x landed_unit_cost` is the delivery's total landed value, which avoids rounding the
 * unit cost twice. The only rounding is the final division, half to even. Reserved units are still
 * on hand, so they count.
 */
export function weightedAverageCost(input: {
  onHandBefore: number;
  avgCostBeforeMinor: bigint;
  receivedQuantity: number;
  incomingValueMinor: bigint;
}): bigint {
  if (input.onHandBefore < 0 || input.receivedQuantity <= 0) {
    throw new Error('Quantities must be positive.');
  }
  const existingValue = BigInt(input.onHandBefore) * input.avgCostBeforeMinor;
  return divideRound(
    existingValue + input.incomingValueMinor,
    BigInt(input.onHandBefore + input.receivedQuantity),
    'half-even',
  );
}
