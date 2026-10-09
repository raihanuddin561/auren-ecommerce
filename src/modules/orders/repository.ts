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
      email: true,
      status: true,
      paymentStatus: true,
      channel: true,
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

// ---------------------------------------------------------------------------------------------
// Locking, status writes, attempts, queue
// ---------------------------------------------------------------------------------------------

/** Locks the order row for the length of the transaction (verification and fulfilment serialise on it). */
export async function lockOrder(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Moves an order from one status to another, only if it is still in the status the caller read
 * (compare and set). Returns false when somebody else moved it first.
 */
export async function setStatus(
  tx: Tx,
  id: string,
  from: OrderStatus,
  data: Prisma.OrderUncheckedUpdateManyInput,
): Promise<boolean> {
  const result = await tx.order.updateMany({ where: { id, status: from }, data });
  return result.count === 1;
}

export const patchOrder = (tx: Tx, id: string, data: Prisma.OrderUncheckedUpdateInput) =>
  tx.order.update({ where: { id }, data });

export const insertAttempt = (tx: Tx, data: Prisma.OrderVerificationAttemptUncheckedCreateInput) =>
  tx.orderVerificationAttempt.create({ data });

export const listAttempts = (tx: Tx, orderId: string) =>
  tx.orderVerificationAttempt.findMany({
    where: { orderId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { staff: { select: { id: true, user: { select: { name: true } } } } },
  });

export const countAttempts = (tx: Tx, orderId: string, outcomes: readonly string[] | null) =>
  tx.orderVerificationAttempt.count({
    where: {
      orderId,
      ...(outcomes
        ? { outcome: { in: [...outcomes] as Array<'no_answer' | 'busy' | 'wrong_number'> } }
        : {}),
    },
  });

/** An active staff member who holds orders.verify (the owner always does): who a manager may assign to. */
export async function eligibleVerifier(tx: Tx, staffId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ ok: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM staff_members s
       WHERE s.id = ${staffId}::uuid AND s.active
         AND (s.role = 'owner' OR EXISTS (
           SELECT 1 FROM role_permissions rp
            WHERE rp.role = s.role AND rp.permission = 'orders.verify'))
    ) AS ok`;
  return Boolean(rows[0]?.ok);
}

/** Active staff who may verify orders (the owner always may), for the assign menu. */
export async function verifierStaff(tx: Tx) {
  const rows = await tx.$queryRaw<Array<{ id: string; role: string; name: string }>>`
    SELECT s.id, s.role::text AS role, u.name
      FROM staff_members s JOIN users u ON u.id = s.user_id
     WHERE s.active AND (s.role = 'owner' OR EXISTS (
       SELECT 1 FROM role_permissions rp WHERE rp.role = s.role AND rp.permission = 'orders.verify'))
     ORDER BY u.name`;
  return rows;
}

/** A parcel that is booked or on its way: the order cannot be cancelled until it is dealt with. */
export async function hasLiveShipment(tx: Tx, orderId: string): Promise<boolean> {
  const count = await tx.shipment.count({
    where: { orderId, status: { notIn: ['pending', 'failed', 'returned'] } },
  });
  return count > 0;
}

export const deleteItems = (tx: Tx, ids: readonly string[]) =>
  tx.orderItem.deleteMany({ where: { id: { in: [...ids] } } });

export const updateItem = (tx: Tx, id: string, data: Prisma.OrderItemUncheckedUpdateInput) =>
  tx.orderItem.update({ where: { id }, data });

export const staffNames = (tx: Tx, ids: readonly string[]) =>
  tx.staffMember.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, role: true, user: { select: { name: true } } },
  });

export interface QueueFilters {
  statuses: readonly OrderStatus[];
  assignedTo?: string | null | 'unassigned';
  /** Orders with an overdue SLA are computed by the service; this narrows to ids when set. */
  onlyIds?: readonly string[];
  highRisk?: boolean;
  prepaid?: boolean;
  needsReview?: boolean;
}

export const listQueue = (tx: Tx, filters: QueueFilters) => {
  const where: Prisma.OrderWhereInput = { status: { in: [...filters.statuses] } };
  if (filters.assignedTo === 'unassigned') where.assignedTo = null;
  else if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.onlyIds) where.id = { in: [...filters.onlyIds] };
  if (filters.highRisk) where.riskScore = { gte: 50 };
  if (filters.prepaid) where.paymentStatus = { in: ['paid', 'pending'] };
  if (filters.needsReview) where.needsManagerReview = true;
  return tx.order.findMany({
    where,
    orderBy: [{ placedAt: 'asc' }, { id: 'asc' }],
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      phone: true,
      status: true,
      paymentStatus: true,
      channel: true,
      totalMinor: true,
      currency: true,
      placedAt: true,
      riskScore: true,
      riskFlags: true,
      assignedTo: true,
      claimExpiresAt: true,
      verificationAttempts: true,
      nextAttemptAt: true,
      needsManagerReview: true,
      escalatedAt: true,
      _count: { select: { items: true } },
      payments: { select: { provider: true }, take: 1 },
    },
  });
};

/** Orders from one phone, for the customer card in the verification workspace. */
export const ordersOfPhone = (tx: Tx, phone: string, excludeId: string) =>
  tx.order.findMany({
    where: { phone, id: { not: excludeId } },
    orderBy: { placedAt: 'desc' },
    take: 8,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalMinor: true,
      currency: true,
      placedAt: true,
    },
  });

export const itemsWithVariant = (tx: Tx, orderId: string) =>
  tx.orderItem.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });

/** The unpaid payment record follows the order total while staff change the order (nothing was collected). */
export const syncPendingPaymentAmount = (tx: Tx, orderId: string, amountMinor: bigint) =>
  tx.payment.updateMany({
    where: { orderId, status: { in: ['initiated', 'pending'] } },
    data: { amountMinor },
  });

/** Open orders placed before the cutoff that no manager was told about yet. */
export const escalationCandidates = (tx: Tx, statuses: readonly OrderStatus[], cutoff: Date) =>
  tx.order.findMany({
    where: { status: { in: [...statuses] }, escalatedAt: null, placedAt: { lte: cutoff } },
    select: { id: true, placedAt: true },
    take: 200,
    orderBy: { placedAt: 'asc' },
  });

/** Marks an open order as escalated once; false when it was already flagged or has moved on. */
export async function flagEscalated(
  tx: Tx,
  id: string,
  statuses: readonly OrderStatus[],
  at: Date,
): Promise<boolean> {
  const result = await tx.order.updateMany({
    where: { id, escalatedAt: null, status: { in: [...statuses] } },
    data: { escalatedAt: at },
  });
  return result.count === 1;
}

// ---------------------------------------------------------------------------------------------
// Fulfilment helpers
// ---------------------------------------------------------------------------------------------

/** Orders from this phone that came back to origin within the last `days` days. */
export const countReturnsToOrigin = (tx: Tx, phone: string, excludeOrderId: string, days: number) =>
  tx.order.count({
    where: {
      phone,
      id: { not: excludeOrderId },
      returnedToOriginAt: { gte: new Date(Date.now() - days * 24 * 3600 * 1000) },
    },
  });

export const listCompletable = (tx: Tx, cutoff: Date) =>
  tx.order.findMany({
    where: { status: 'delivered', deliveredAt: { lte: cutoff } },
    select: { id: true },
    orderBy: { deliveredAt: 'asc' },
    take: 200,
  });

const OPEN_RETURN_STATUSES = [
  'requested',
  'approved',
  'in_transit',
  'received',
  'inspected',
] as const;

/** A return that still needs a decision or a resolution keeps the order from completing. */
export async function hasOpenReturn(tx: Tx, orderId: string): Promise<boolean> {
  const count = await tx.returnRequest.count({
    where: { orderId, status: { in: [...OPEN_RETURN_STATUSES] } },
  });
  return count > 0;
}

/** Exchanges resolved on an order and the replacement parcels already sent for them. */
export async function replacementCounts(
  tx: Tx,
  orderId: string,
): Promise<{ exchanged: number; shipped: number }> {
  const [exchanged, shipped] = await Promise.all([
    tx.returnRequest.count({ where: { orderId, status: 'exchanged' } }),
    tx.shipment.count({ where: { orderId, kind: 'replacement' } }),
  ]);
  return { exchanged, shipped };
}

/** District and thana text of orders, for the fulfilment board. */
export async function shippingAreas(tx: Tx, ids: readonly string[]) {
  if (ids.length === 0) return [];
  const rows = await tx.order.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, shippingAddress: true },
  });
  return rows.map((row) => {
    const address = row.shippingAddress as {
      district?: { name?: string };
      thana?: { name?: string };
    } | null;
    return {
      id: row.id,
      area: [address?.thana?.name, address?.district?.name].filter(Boolean).join(', '),
    };
  });
}

export const orderNumbers = (tx: Tx, ids: readonly string[]) =>
  ids.length === 0
    ? Promise.resolve([] as Array<{ id: string; orderNumber: string }>)
    : tx.order.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, orderNumber: true },
      });

// ---------------------------------------------------------------------------------------------
// What the customer sees beyond the order itself
// ---------------------------------------------------------------------------------------------

export const customerVisibleEvents = (tx: Tx, orderId: string) =>
  tx.orderEvent.findMany({
    where: {
      orderId,
      type: {
        in: [
          'placed',
          'status_changed',
          'order_edited',
          'shipped',
          'delivered',
          'delivery_failed',
          'refund',
          'return_requested',
          'return_approved',
          'return_received',
          'returned',
          'replacement_shipped',
          'refunded',
          'exchanged',
          'completed',
        ],
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { type: true, toStatus: true, createdAt: true },
  });

export const latestOutboundParcel = (tx: Tx, orderId: string) =>
  tx.shipment.findFirst({
    where: { orderId, kind: 'outbound' },
    orderBy: { createdAt: 'desc' },
    select: { courier: true, courierName: true, trackingNumber: true, status: true },
  });

export const returnsForCustomer = (tx: Tx, orderId: string) =>
  tx.returnRequest.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    select: { returnNumber: true, type: true, status: true },
  });

/** Units of each line that cannot be returned again: returned already or in an open request. */
export async function unitsSpokenFor(tx: Tx, orderId: string): Promise<Map<string, number>> {
  const rows = await tx.returnItem.groupBy({
    by: ['orderItemId'],
    where: {
      returnRequest: {
        orderId,
        status: { in: ['requested', 'approved', 'in_transit', 'received'] },
      },
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
}

/** Returns of an order with their items, for the admin order page. */
export const returnsWithItems = (tx: Tx, orderId: string) =>
  tx.returnRequest.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      returnNumber: true,
      type: true,
      status: true,
      resolution: true,
      customerNote: true,
      staffNote: true,
      createdAt: true,
      currency: true,
      returnShippingCostMinor: true,
      items: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          quantity: true,
          reason: true,
          condition: true,
          exchangeVariantId: true,
          orderItem: {
            select: { titleSnapshot: true, variantTitleSnapshot: true, unitPriceMinor: true },
          },
        },
      },
    },
  });
