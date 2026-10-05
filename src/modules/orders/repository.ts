import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';
import { OPEN_ORDER_STATUSES, type OrderStatus } from './timeline';

/** Data access for orders. No business rules here. */

export const insertOrder = (tx: Tx, data: Prisma.OrderUncheckedCreateInput) =>
  tx.order.create({ data, select: { id: true, orderNumber: true, placedAt: true } });

export const insertItems = (tx: Tx, data: Prisma.OrderItemCreateManyInput[]) =>
  tx.orderItem.createMany({ data });

export const insertEvent = (
  tx: Tx,
  data: {
    orderId: string;
    type: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    payload?: Prisma.InputJsonValue;
    actorId?: string | null;
  },
) =>
  tx.orderEvent.create({
    data: {
      orderId: data.orderId,
      type: data.type,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus ?? null,
      payload: data.payload ?? {},
      actorId: data.actorId ?? null,
    },
  });

/**
 * Serialises checkouts of one phone number for the length of the transaction, so the per-phone
 * limits and unit caps hold even when many requests arrive at once (INV-O11).
 */
export async function lockPhone(tx: Tx, phone: string): Promise<void> {
  const key = createHash('sha256').update(`checkout-phone:${phone}`).digest().readBigInt64BE(0);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
}

export interface VelocityCounts {
  openByPhone: number;
  dayByPhone: number;
  everByPhone: number;
  openByAddress: number;
  dayByIp: number;
  /** Units already held per variant by this phone in orders still waiting for staff. */
  heldUnits: Map<string, number>;
}

export async function velocityCounts(
  tx: Tx,
  input: {
    phone: string;
    addressHash: string;
    ipHash: string | null;
    variantIds: readonly string[];
    now: Date;
  },
): Promise<VelocityCounts> {
  const open = [...OPEN_ORDER_STATUSES] as OrderStatus[];
  const dayAgo = new Date(input.now.getTime() - 24 * 3600 * 1000);
  const [openByPhone, dayByPhone, everByPhone, openByAddress, dayByIp, held] = await Promise.all([
    tx.order.count({ where: { phone: input.phone, status: { in: open } } }),
    tx.order.count({ where: { phone: input.phone, placedAt: { gte: dayAgo } } }),
    tx.order.count({ where: { phone: input.phone } }),
    tx.order.count({ where: { addressHash: input.addressHash, status: { in: open } } }),
    input.ipHash
      ? tx.order.count({ where: { ipHash: input.ipHash, placedAt: { gte: dayAgo } } })
      : Promise.resolve(0),
    tx.orderItem.groupBy({
      by: ['variantId'],
      where: {
        variantId: { in: [...input.variantIds] },
        order: { phone: input.phone, status: { in: open } },
      },
      _sum: { quantity: true },
    }),
  ]);
  return {
    openByPhone,
    dayByPhone,
    everByPhone,
    openByAddress,
    dayByIp,
    heldUnits: new Map(held.map((row) => [row.variantId, row._sum.quantity ?? 0])),
  };
}

export const activeRiskFlags = (tx: Tx, phone: string, now: Date) =>
  tx.customerRiskFlag.findMany({
    where: { phone, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { type: true },
  });

const detailInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

export const findByTrackingHash = (tx: Tx, hash: string) =>
  tx.order.findUnique({ where: { trackingTokenHash: hash }, include: detailInclude });

export const findByNumber = (tx: Tx, orderNumber: string) =>
  tx.order.findUnique({ where: { orderNumber }, include: detailInclude });

export const findById = (tx: Tx, id: string) =>
  tx.order.findUnique({ where: { id }, include: detailInclude });

export const findEvents = (tx: Tx, orderId: string) =>
  tx.orderEvent.findMany({ where: { orderId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

export const listOrders = (
  tx: Tx,
  input: { where: Prisma.OrderWhereInput; skip: number; take: number },
) =>
  tx.order.findMany({
    where: input.where,
    orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
    skip: input.skip,
    take: input.take,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      phone: true,
      status: true,
      paymentStatus: true,
      totalMinor: true,
      currency: true,
      placedAt: true,
      riskFlags: true,
      _count: { select: { items: true } },
    },
  });

export const countOrders = (tx: Tx, where: Prisma.OrderWhereInput) => tx.order.count({ where });

export const statusCounts = (tx: Tx) =>
  tx.order.groupBy({ by: ['status'], _count: { _all: true } });

export const updateOrder = (tx: Tx, id: string, data: Prisma.OrderUpdateInput) =>
  tx.order.update({ where: { id }, data });

export const findOrderItems = (tx: Tx, orderId: string) =>
  tx.orderItem.findMany({ where: { orderId } });

export const createRiskFlag = (tx: Tx, data: Prisma.CustomerRiskFlagUncheckedCreateInput) =>
  tx.customerRiskFlag.create({ data });
