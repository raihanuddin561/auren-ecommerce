import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';
import type { CreateDiscountInput, UpdateDiscountInput } from './schemas';
import type { DiscountRecord } from './types';

type DbOrTx = PrismaClient | Tx;

function toRecord(row: {
  id: string;
  code: string | null;
  title: string;
  type: DiscountRecord['type'];
  value: Prisma.Decimal;
  appliesTo: DiscountRecord['appliesTo'];
  targetIds: string[];
  minSubtotalMinor: bigint | null;
  minQuantity: number | null;
  maxDiscountMinor: bigint | null;
  customerEligibility: DiscountRecord['customerEligibility'];
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usageCount: number;
  combinable: boolean;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DiscountRecord {
  return {
    ...row,
    value: Number(row.value),
  };
}

export async function findDiscountByCode(db: DbOrTx, code: string): Promise<DiscountRecord | null> {
  const normalized = code.trim();
  if (!normalized) return null;

  const row = await db.discount.findUnique({
    where: { code: normalized },
  });

  return row ? toRecord(row) : null;
}

export async function findDiscountById(db: DbOrTx, id: string): Promise<DiscountRecord | null> {
  const row = await db.discount.findUnique({
    where: { id },
  });

  return row ? toRecord(row) : null;
}

/**
 * Counts how many times this discount has been redeemed by this customer (user or phone).
 */
export async function countCustomerRedemptions(
  db: DbOrTx,
  discountId: string,
  customer: { userId?: string | null; phone?: string | null },
): Promise<number> {
  const conditions: Prisma.DiscountRedemptionWhereInput[] = [];

  if (customer.userId) {
    conditions.push({ userId: customer.userId });
  }
  if (customer.phone) {
    conditions.push({ phone: customer.phone });
  }

  if (conditions.length === 0) return 0;

  return db.discountRedemption.count({
    where: {
      discountId,
      OR: conditions,
    },
  });
}

/**
 * Counts non-cancelled orders for a customer to verify "new" customer eligibility.
 */
export async function countCustomerOrders(
  db: DbOrTx,
  customer: { userId?: string | null; phone?: string | null },
): Promise<number> {
  const conditions: Prisma.OrderWhereInput[] = [];

  if (customer.userId) {
    conditions.push({ userId: customer.userId });
  }
  if (customer.phone) {
    conditions.push({ phone: customer.phone });
  }

  if (conditions.length === 0) return 0;

  return db.order.count({
    where: {
      status: { notIn: ['cancelled', 'payment_expired'] },
      OR: conditions,
    },
  });
}

/**
 * Atomic conditional usage claim (INV-D1).
 * Increments usage_count only if the discount is active and within its usage_limit.
 * Returns true if claimed successfully, false if the limit was reached or discount inactive.
 */
export async function claimDiscountUsage(tx: Tx, discountId: string): Promise<boolean> {
  const count = await tx.$executeRaw`
    UPDATE discounts
    SET usage_count = usage_count + 1, updated_at = NOW()
    WHERE id = ${discountId}::uuid
      AND is_active = true
      AND (usage_limit IS NULL OR usage_count < usage_limit)
  `;

  return count > 0;
}

/** Records redemption inside the order transaction. */
export async function insertRedemption(
  tx: Tx,
  data: {
    discountId: string;
    orderId: string;
    userId?: string | null;
    phone?: string | null;
    amountMinor: bigint;
  },
): Promise<void> {
  await tx.discountRedemption.create({
    data: {
      discountId: data.discountId,
      orderId: data.orderId,
      userId: data.userId ?? null,
      phone: data.phone ?? null,
      amountMinor: data.amountMinor,
    },
  });
}

/**
 * Releases a redemption if an order is cancelled or refunded (INV-D1).
 * Decrements the discount's usage_count and deletes the redemption record.
 */
export async function releaseRedemption(tx: Tx, orderId: string): Promise<void> {
  const redemptions = await tx.discountRedemption.findMany({
    where: { orderId },
  });

  for (const r of redemptions) {
    await tx.$executeRaw`
      UPDATE discounts
      SET usage_count = GREATEST(0, usage_count - 1), updated_at = NOW()
      WHERE id = ${r.discountId}::uuid
    `;
  }

  if (redemptions.length > 0) {
    await tx.discountRedemption.deleteMany({
      where: { orderId },
    });
  }
}

/** Admin listing with pagination and filters. */
export async function listDiscountsForAdmin(
  db: DbOrTx,
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: 'all' | 'active' | 'inactive';
  } = {},
): Promise<{
  items: DiscountRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.DiscountWhereInput = {};

  if (options.status === 'active') {
    where.isActive = true;
  } else if (options.status === 'inactive') {
    where.isActive = false;
  }

  if (options.search) {
    const q = options.search.trim();
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    db.discount.count({ where }),
    db.discount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toRecord),
    total,
    page,
    pageSize,
  };
}

export async function createDiscount(
  db: DbOrTx,
  input: CreateDiscountInput,
): Promise<DiscountRecord> {
  const minSubtotalMinor =
    input.minSubtotal !== undefined && input.minSubtotal !== null
      ? BigInt(Math.round(input.minSubtotal * 100))
      : null;

  const maxDiscountMinor =
    input.maxDiscount !== undefined && input.maxDiscount !== null
      ? BigInt(Math.round(input.maxDiscount * 100))
      : null;

  const row = await db.discount.create({
    data: {
      code: input.code ? input.code.trim().toUpperCase() : null,
      title: input.title,
      type: input.type,
      value: new Prisma.Decimal(input.value),
      appliesTo: input.appliesTo,
      targetIds: input.targetIds,
      minSubtotalMinor,
      minQuantity: input.minQuantity,
      maxDiscountMinor,
      customerEligibility: input.customerEligibility,
      usageLimit: input.usageLimit,
      usageLimitPerCustomer: input.usageLimitPerCustomer,
      combinable: input.combinable,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive,
    },
  });

  return toRecord(row);
}

export async function updateDiscount(
  db: DbOrTx,
  input: UpdateDiscountInput,
): Promise<DiscountRecord> {
  const data: Prisma.DiscountUpdateInput = {};

  if (input.code !== undefined) {
    data.code = input.code ? input.code.trim().toUpperCase() : null;
  }
  if (input.title !== undefined) data.title = input.title;
  if (input.type !== undefined) data.type = input.type;
  if (input.value !== undefined) data.value = new Prisma.Decimal(input.value);
  if (input.appliesTo !== undefined) data.appliesTo = input.appliesTo;
  if (input.targetIds !== undefined) data.targetIds = input.targetIds;
  if (input.minSubtotal !== undefined) {
    data.minSubtotalMinor =
      input.minSubtotal !== null ? BigInt(Math.round(input.minSubtotal * 100)) : null;
  }
  if (input.minQuantity !== undefined) data.minQuantity = input.minQuantity;
  if (input.maxDiscount !== undefined) {
    data.maxDiscountMinor =
      input.maxDiscount !== null ? BigInt(Math.round(input.maxDiscount * 100)) : null;
  }
  if (input.customerEligibility !== undefined) {
    data.customerEligibility = input.customerEligibility;
  }
  if (input.usageLimit !== undefined) data.usageLimit = input.usageLimit;
  if (input.usageLimitPerCustomer !== undefined) {
    data.usageLimitPerCustomer = input.usageLimitPerCustomer;
  }
  if (input.combinable !== undefined) data.combinable = input.combinable;
  if (input.startsAt !== undefined) data.startsAt = input.startsAt;
  if (input.endsAt !== undefined) data.endsAt = input.endsAt;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const row = await db.discount.update({
    where: { id: input.id },
    data,
  });

  return toRecord(row);
}

export async function setDiscountActive(
  db: DbOrTx,
  id: string,
  isActive: boolean,
): Promise<DiscountRecord> {
  const row = await db.discount.update({
    where: { id },
    data: { isActive },
  });

  return toRecord(row);
}
