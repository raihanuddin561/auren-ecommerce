import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { allocate, money, zero, type Money } from '@/lib/money';
import { hashCartToken, isCartToken } from '@/modules/cart/token';
import type { CartIdentity } from '@/modules/cart/types';
import * as repo from './repository';
import type { CreateDiscountInput, UpdateDiscountInput } from './schemas';
import type {
  DiscountEvaluationContext,
  DiscountRecord,
  EvaluatedDiscount,
  EvaluatedDiscountLine,
  LineForDiscount,
} from './types';

export const GENERIC_COUPON_ERROR = 'Invalid or expired discount code';

/**
 * Checks whether a specific line item is eligible for the discount based on appliesTo scope.
 */
export function isLineEligible(discount: DiscountRecord, line: LineForDiscount): boolean {
  if (discount.appliesTo === 'order') return true;
  if (discount.targetIds.length === 0) return true;

  if (discount.appliesTo === 'products') {
    return discount.targetIds.includes(line.productId);
  }

  if (discount.appliesTo === 'categories') {
    return line.categoryId ? discount.targetIds.includes(line.categoryId) : false;
  }

  if (discount.appliesTo === 'collections') {
    return line.collectionIds
      ? line.collectionIds.some((id) => discount.targetIds.includes(id))
      : false;
  }

  return false;
}

/**
 * Evaluates whether a discount is applicable to the provided lines and context,
 * and calculates the exact line-by-line discount allocation.
 */
export async function evaluateDiscount(
  discount: DiscountRecord,
  lines: LineForDiscount[],
  context: DiscountEvaluationContext = {},
  dbClient: Tx = db,
): Promise<EvaluatedDiscount | null> {
  const now = context.now ?? new Date();

  // 1. Date window & active flag
  if (!discount.isActive) return null;
  if (discount.startsAt > now) return null;
  if (discount.endsAt && discount.endsAt < now) return null;

  // 2. Global usage limit check (advisory preview check; checkout enforces atomic conditional UPDATE)
  if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
    return null;
  }

  // 3. Customer eligibility
  const customer = { userId: context.userId, phone: context.phone };
  if (discount.customerEligibility === 'new') {
    const priorOrders = await repo.countCustomerOrders(dbClient, customer);
    if (priorOrders > 0) return null;
  }

  // 4. Per-customer usage limit
  if (discount.usageLimitPerCustomer !== null) {
    const priorUses = await repo.countCustomerRedemptions(dbClient, discount.id, customer);
    if (priorUses >= discount.usageLimitPerCustomer) return null;
  }

  // 5. Lines and subtotal calculation
  const eligibleLines = lines.filter((l) => isLineEligible(discount, l));
  if (eligibleLines.length === 0) return null;

  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  if (discount.minQuantity !== null && totalQuantity < discount.minQuantity) {
    return null;
  }

  const currency = lines[0]?.currency ?? 'BDT';
  const orderSubtotalMinor = lines.reduce(
    (sum, l) => sum + l.unitPriceMinor * BigInt(l.quantity),
    0n,
  );

  if (discount.minSubtotalMinor !== null && orderSubtotalMinor < discount.minSubtotalMinor) {
    return null;
  }

  const eligibleSubtotalMinor = eligibleLines.reduce(
    (sum, l) => sum + l.unitPriceMinor * BigInt(l.quantity),
    0n,
  );

  if (eligibleSubtotalMinor <= 0n) return null;

  // 6. Discount amount calculation
  let calculatedMinor = 0n;
  let freeShipping = false;

  if (discount.type === 'free_shipping') {
    freeShipping = true;
    calculatedMinor = context.shippingChargeMinor ?? 0n;
  } else if (discount.type === 'percentage') {
    const percentBps = BigInt(Math.round(discount.value * 100)); // e.g. 15% -> 1500 bps
    calculatedMinor = (eligibleSubtotalMinor * percentBps) / 10000n;
    if (discount.maxDiscountMinor !== null && calculatedMinor > discount.maxDiscountMinor) {
      calculatedMinor = discount.maxDiscountMinor;
    }
  } else if (discount.type === 'fixed_amount') {
    const fixedMinor = BigInt(Math.round(discount.value * 100));
    calculatedMinor = fixedMinor > eligibleSubtotalMinor ? eligibleSubtotalMinor : fixedMinor;
  }

  if (calculatedMinor > eligibleSubtotalMinor) {
    calculatedMinor = eligibleSubtotalMinor;
  }

  // 7. Proportional line allocation via allocate() (INV-M4)
  const lineAllocations: EvaluatedDiscountLine[] = [];

  if (calculatedMinor > 0n && discount.type !== 'free_shipping') {
    const weights = eligibleLines.map((l) => l.unitPriceMinor * BigInt(l.quantity));
    const allocatedShares = allocate(money(calculatedMinor, currency), weights);

    const eligibleMap = new Map<string, Money>();
    eligibleLines.forEach((l, index) => {
      eligibleMap.set(l.variantId, allocatedShares[index] ?? zero(currency));
    });

    for (const line of lines) {
      const lineSubtotal = line.unitPriceMinor * BigInt(line.quantity);
      const allocated = eligibleMap.get(line.variantId) ?? zero(currency);
      const discountMinor = allocated.minor;
      lineAllocations.push({
        variantId: line.variantId,
        discountMinor,
        totalMinor: lineSubtotal - discountMinor,
      });
    }
  } else {
    for (const line of lines) {
      const lineSubtotal = line.unitPriceMinor * BigInt(line.quantity);
      lineAllocations.push({
        variantId: line.variantId,
        discountMinor: 0n,
        totalMinor: lineSubtotal,
      });
    }
  }

  return {
    id: discount.id,
    code: discount.code,
    title: discount.title,
    type: discount.type,
    discountMinor: calculatedMinor,
    freeShipping,
    lines: lineAllocations,
  };
}

/**
 * Validates and applies a coupon code to the user's active cart.
 * If code is invalid or ineligble, throws generic coupon error.
 */
export async function applyCouponToCart(
  identity: CartIdentity,
  code: string,
): Promise<{ code: string; title: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    throw new DomainError('VALIDATION', GENERIC_COUPON_ERROR);
  }

  const discount = await repo.findDiscountByCode(db, normalized);
  if (!discount || !discount.isActive) {
    throw new DomainError('VALIDATION', GENERIC_COUPON_ERROR);
  }

  const now = new Date();
  if (discount.startsAt > now || (discount.endsAt && discount.endsAt < now)) {
    throw new DomainError('VALIDATION', GENERIC_COUPON_ERROR);
  }

  if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
    throw new DomainError('VALIDATION', GENERIC_COUPON_ERROR);
  }

  const tokenHash = isCartToken(identity.token) ? hashCartToken(identity.token) : null;

  // Associate with the cart
  await db.cart.updateMany({
    where: identity.userId
      ? { userId: identity.userId }
      : tokenHash
        ? { tokenHash }
        : { id: '00000000-0000-0000-0000-000000000000' },
    data: { discountCode: normalized },
  });

  return {
    code: normalized,
    title: discount.title,
  };
}

/** Removes any active coupon from the cart. */
export async function removeCouponFromCart(identity: CartIdentity): Promise<void> {
  const tokenHash = isCartToken(identity.token) ? hashCartToken(identity.token) : null;

  await db.cart.updateMany({
    where: identity.userId
      ? { userId: identity.userId }
      : tokenHash
        ? { tokenHash }
        : { id: '00000000-0000-0000-0000-000000000000' },
    data: { discountCode: null },
  });
}

/** Reads the coupon code attached to the current cart. */
export async function getCartDiscountCode(identity: CartIdentity): Promise<string | null> {
  const tokenHash = isCartToken(identity.token) ? hashCartToken(identity.token) : null;

  const cartRow = await db.cart.findFirst({
    where: identity.userId
      ? { userId: identity.userId }
      : tokenHash
        ? { tokenHash }
        : { id: '00000000-0000-0000-0000-000000000000' },
    select: { discountCode: true },
  });

  return cartRow?.discountCode ?? null;
}

/**
 * Executes inside the checkout order transaction (INV-D1):
 * 1. Evaluates discount
 * 2. Conditionally atomic UPDATE usage count
 * 3. Records redemption
 */
export async function claimAndRecordRedemptionInTx(
  tx: Tx,
  options: {
    discountCode: string;
    orderId: string;
    lines: LineForDiscount[];
    shippingChargeMinor: bigint;
    userId?: string | null;
    phone?: string | null;
  },
): Promise<EvaluatedDiscount> {
  const discount = await repo.findDiscountByCode(tx, options.discountCode);
  if (!discount) {
    throw new DomainError('VALIDATION', GENERIC_COUPON_ERROR);
  }

  const evaluated = await evaluateDiscount(
    discount,
    options.lines,
    {
      userId: options.userId,
      phone: options.phone,
      shippingChargeMinor: options.shippingChargeMinor,
    },
    tx,
  );

  if (!evaluated) {
    throw new DomainError('VALIDATION', GENERIC_COUPON_ERROR);
  }

  // Atomic conditional UPDATE on usage_limit (INV-D1)
  const claimed = await repo.claimDiscountUsage(tx, discount.id);
  if (!claimed) {
    throw new DomainError('VALIDATION', GENERIC_COUPON_ERROR);
  }

  // Record redemption in ledger
  await repo.insertRedemption(tx, {
    discountId: discount.id,
    orderId: options.orderId,
    userId: options.userId,
    phone: options.phone,
    amountMinor: evaluated.discountMinor,
  });

  return evaluated;
}

/** Releases redemptions when an order is cancelled (INV-D1). */
export async function releaseRedemptionForOrder(tx: Tx, orderId: string): Promise<void> {
  await repo.releaseRedemption(tx, orderId);
}

/** Looks up a discount by code and evaluates it against lines (read-only for preview/checkout). */
export async function findAndEvaluateDiscount(
  code: string,
  lines: LineForDiscount[],
  context: DiscountEvaluationContext = {},
): Promise<EvaluatedDiscount | null> {
  const discount = await repo.findDiscountByCode(db, code);
  if (!discount) return null;
  return evaluateDiscount(discount, lines, context);
}

/** Admin mutations delegated through service layer */
export async function createDiscount(input: CreateDiscountInput): Promise<DiscountRecord> {
  return repo.createDiscount(db, input);
}

export async function updateDiscount(input: UpdateDiscountInput): Promise<DiscountRecord> {
  return repo.updateDiscount(db, input);
}

export async function setDiscountActive(id: string, isActive: boolean): Promise<DiscountRecord> {
  return repo.setDiscountActive(db, id, isActive);
}
