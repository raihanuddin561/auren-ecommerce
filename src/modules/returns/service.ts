import type { Prisma } from '@/generated/prisma/client';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { enqueueEvent } from '@/lib/outbox';
import { shipReplacement } from '@/modules/orders/fulfilment';
import { orderIdForToken } from '@/modules/orders/service';
import { verifyOrderProof } from '@/modules/orders/tracking';
import { money, toDecimalString } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import * as catalog from '@/modules/catalog/service';
import * as finance from '@/modules/finance/service';
import * as inventory from '@/modules/inventory/service';
import {
  markReturnRequested,
  markReturned,
  reopenAsDelivered,
  settleReturn,
} from '@/modules/orders/return-transitions';
import { processRefund } from '@/modules/payments/refunds';
import { getReturnSettings } from '@/modules/settings/service';
import * as repo from './repository';
import type { ReturnDetail } from './repository';

/**
 * Returns and exchanges (6.12). A customer asks (inside the window, from their order page); staff
 * approve or reject, receive the parcel, inspect each item (resellable goods go back on the shelf,
 * damaged goods are written off), then resolve: refund, store credit, or an exchange for another
 * size. Money moves only through the refund service (permission, step-up and approval gates there),
 * stock only through the inventory service, and every step is a timeline row, an outbox event and
 * (for staff) an audit row.
 */

export interface ReturnStaff {
  /** staff_members.id */
  staffId: string;
  /** users.id */
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export const RETURN_REASONS = [
  'too_small',
  'too_large',
  'defective',
  'not_as_described',
  'changed_mind',
] as const;
export type ReturnReasonId = (typeof RETURN_REASONS)[number];

export interface RequestReturnInput {
  orderId: string;
  type: 'return' | 'exchange';
  items: Array<{
    orderItemId: string;
    quantity: number;
    reason: ReturnReasonId;
    exchangeVariantId?: string | undefined;
  }>;
  note?: string | undefined;
  now?: Date;
}

const DAY_MS = 24 * 3600 * 1000;

/** The last moment a return can be requested, from the delivery date and the window. */
export const returnDeadline = (deliveredAt: Date, windowDays: number): Date =>
  new Date(deliveredAt.getTime() + windowDays * DAY_MS);

const dateText = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Asia/Dhaka' });

async function emit(tx: Tx, returnId: string, orderId: string, status: string) {
  await enqueueEvent(tx, {
    type: 'return.status_changed',
    aggregateType: 'return',
    aggregateId: returnId,
    payload: { returnId, orderId, status },
  });
}

async function staffAudit(
  tx: Tx,
  staff: ReturnStaff,
  action: string,
  returnId: string,
  before: unknown,
  after: unknown,
) {
  await audit(tx, {
    actorId: staff.userId,
    action,
    entity: 'return',
    entityId: returnId,
    before,
    after,
    ip: staff.ip ?? null,
    userAgent: staff.userAgent ?? null,
  });
}

async function loadLockedReturn(tx: Tx, id: string): Promise<ReturnDetail> {
  if (!(await repo.lockReturn(tx, id))) throw new DomainError('NOT_FOUND', 'Return not found');
  const found = await repo.findReturn(tx, id);
  if (!found) throw new DomainError('NOT_FOUND', 'Return not found');
  return found;
}

// ---------------------------------------------------------------------------------------------
// Customer request
// ---------------------------------------------------------------------------------------------

/**
 * Opens a return or exchange for a delivered order, inside the return window. The caller has
 * already shown that the visitor owns the order (the proof cookie). Quantities are checked against
 * what was delivered and is not already spoken for; an exchange needs a replacement of the same
 * product at the same price (a different price is a refund and a new order).
 */
export async function requestReturn(tx: Tx, input: RequestReturnInput) {
  const now = input.now ?? new Date();
  const settings = await getReturnSettings(tx);
  const order = await repo.lockOrderForReturn(tx, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');

  if (order.status !== 'delivered' && order.status !== 'return_requested') {
    throw new DomainError(
      'CONFLICT',
      'A return can be requested once your order has been delivered.',
    );
  }
  if (!order.deliveredAt) throw new DomainError('CONFLICT', 'This order has no delivery date yet.');
  const deadline = returnDeadline(order.deliveredAt, settings.windowDays);
  if (now.getTime() > deadline.getTime()) {
    throw new DomainError(
      'CONFLICT',
      `The ${settings.windowDays}-day return window ended on ${dateText.format(deadline)}. Please message our concierge and we will help.`,
    );
  }
  if (await repo.hasOtherOpenReturn(tx, order.id, '00000000-0000-0000-0000-000000000000')) {
    throw new DomainError(
      'CONFLICT',
      'You already have a return in progress for this order. We will be in touch about it.',
    );
  }

  const lines = new Map(
    (await repo.orderLinesForReturn(tx, order.id)).map((line) => [line.id, line]),
  );
  const spoken = await repo.unitsInOpenReturns(tx, order.id);
  const seen = new Set<string>();
  const exchangeVariantIds = input.items
    .map((item) => item.exchangeVariantId)
    .filter((id): id is string => Boolean(id));
  const replacements = await catalog.getSellableVariants(tx, exchangeVariantIds);
  const stock = await inventory.getAvailability(exchangeVariantIds, tx);

  for (const item of input.items) {
    const line = lines.get(item.orderItemId);
    if (!line || seen.has(line.id)) {
      throw new DomainError('VALIDATION', 'One of the items is not part of this order.', {
        fieldErrors: { items: ['Choose items from this order, once each.'] },
      });
    }
    seen.add(line.id);
    const available = line.quantity - line.quantityReturned - (spoken.get(line.id) ?? 0);
    if (item.quantity < 1 || item.quantity > available) {
      throw new DomainError(
        'VALIDATION',
        `You can return up to ${Math.max(0, available)} of ${line.titleSnapshot}.`,
        {
          fieldErrors: { items: [`You can return up to ${Math.max(0, available)} of this item.`] },
        },
      );
    }
    if (input.type === 'exchange') {
      const replacement = item.exchangeVariantId
        ? replacements.get(item.exchangeVariantId)
        : undefined;
      if (!item.exchangeVariantId || !replacement?.sellable) {
        throw new DomainError('VALIDATION', 'Choose the size you would like instead.', {
          fieldErrors: { items: ['Choose a size to exchange for.'] },
        });
      }
      if (
        replacement.productId !== line.productId ||
        replacement.priceMinor !== line.unitPriceMinor
      ) {
        throw new DomainError(
          'VALIDATION',
          'An exchange must be another size or colour of the same piece. For anything else, please ask for a return.',
          { fieldErrors: { items: ['Choose another size or colour of the same piece.'] } },
        );
      }
      if (replacement.id === line.variantId) {
        throw new DomainError('VALIDATION', 'Choose a different size or colour.', {
          fieldErrors: { items: ['Choose a different size or colour.'] },
        });
      }
      if ((stock.get(replacement.id)?.available ?? 0) < item.quantity) {
        throw new DomainError(
          'OUT_OF_STOCK',
          `${replacement.optionsLabel || 'That size'} is sold out right now.`,
          {
            fieldErrors: { items: ['That size is sold out right now.'] },
          },
        );
      }
    }
  }

  const created = await repo.insertReturn(tx, {
    orderId: order.id,
    type: input.type,
    customerNote: input.note ?? null,
    currency: order.currency,
    requestedBy: 'customer',
    items: input.items.map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      reason: item.reason,
      exchangeVariantId: input.type === 'exchange' ? (item.exchangeVariantId ?? null) : null,
    })),
  });
  await markReturnRequested(tx, {
    orderId: order.id,
    returnNumber: created.returnNumber,
    actor: { kind: 'customer' },
  });
  await emit(tx, created.id, order.id, 'requested');
  return { returnId: created.id, returnNumber: created.returnNumber };
}

// ---------------------------------------------------------------------------------------------
// Staff steps
// ---------------------------------------------------------------------------------------------

export async function approveReturn(
  tx: Tx,
  input: { returnId: string; note?: string | undefined; staff: ReturnStaff },
) {
  const found = await loadLockedReturn(tx, input.returnId);
  if (found.status !== 'requested') {
    throw new DomainError('CONFLICT', 'Only a new request can be approved.');
  }
  await repo.patchReturn(tx, found.id, {
    status: 'approved',
    decidedBy: input.staff.staffId,
    decidedAt: new Date(),
    staffNote: input.note ?? null,
  });
  await repo.insertTimelineRow(tx, {
    orderId: found.orderId,
    type: 'return_approved',
    actorId: input.staff.staffId,
    payload: { returnNumber: found.returnNumber },
  });
  await emit(tx, found.id, found.orderId, 'approved');
  await staffAudit(
    tx,
    input.staff,
    'return.approve',
    found.id,
    { status: 'requested' },
    { status: 'approved' },
  );
  return { returnId: found.id };
}

export async function rejectReturn(
  tx: Tx,
  input: { returnId: string; reason: string; staff: ReturnStaff },
) {
  const found = await loadLockedReturn(tx, input.returnId);
  if (found.status !== 'requested' && found.status !== 'approved') {
    throw new DomainError('CONFLICT', 'Only a request that is not yet received can be rejected.');
  }
  await repo.patchReturn(tx, found.id, {
    status: 'rejected',
    decidedBy: input.staff.staffId,
    decidedAt: new Date(),
    staffNote: input.reason,
    closedAt: new Date(),
  });
  await reopenAsDelivered(tx, {
    orderId: found.orderId,
    returnNumber: found.returnNumber,
    actor: { kind: 'staff', staffId: input.staff.staffId },
    otherOpenReturn: await repo.hasOtherOpenReturn(tx, found.orderId, found.id),
  });
  await emit(tx, found.id, found.orderId, 'rejected');
  await staffAudit(
    tx,
    input.staff,
    'return.reject',
    found.id,
    { status: found.status },
    {
      status: 'rejected',
      reason: input.reason,
    },
  );
  return { returnId: found.id };
}

/** The parcel arrived. Staff note what the return shipping cost us, which joins the order's costs. */
export async function receiveReturn(
  tx: Tx,
  input: { returnId: string; shippingCostMinor: bigint; staff: ReturnStaff },
) {
  const found = await loadLockedReturn(tx, input.returnId);
  if (found.status !== 'approved' && found.status !== 'in_transit') {
    throw new DomainError('CONFLICT', 'Only an approved return can be received.');
  }
  await repo.patchReturn(tx, found.id, {
    status: 'received',
    receivedAt: new Date(),
    returnShippingCostMinor: input.shippingCostMinor,
  });
  await finance.recordCostLine(tx, {
    orderId: found.orderId,
    type: 'return_shipping',
    amountMinor: input.shippingCostMinor,
    currency: found.currency,
    sourceType: 'return',
    sourceId: found.id,
    note: found.returnNumber,
    actorId: input.staff.staffId,
  });
  await repo.insertTimelineRow(tx, {
    orderId: found.orderId,
    type: 'return_received',
    actorId: input.staff.staffId,
    payload: { returnNumber: found.returnNumber },
  });
  await emit(tx, found.id, found.orderId, 'received');
  await staffAudit(
    tx,
    input.staff,
    'return.receive',
    found.id,
    { status: found.status },
    {
      status: 'received',
      shippingCostMinor: input.shippingCostMinor.toString(),
    },
  );
  return { returnId: found.id };
}

/**
 * Staff look at every returned item: resellable goods go back on the shelf, damaged goods are
 * written off. Both through the inventory service; the order lines record how many came back.
 */
export async function inspectReturn(
  tx: Tx,
  input: {
    returnId: string;
    conditions: Array<{ returnItemId: string; condition: 'resellable' | 'damaged' }>;
    note?: string | undefined;
    staff: ReturnStaff;
  },
) {
  const found = await loadLockedReturn(tx, input.returnId);
  if (found.status !== 'received') {
    throw new DomainError('CONFLICT', 'Only a received return can be inspected.');
  }
  const byId = new Map(input.conditions.map((entry) => [entry.returnItemId, entry.condition]));
  if (found.items.some((item) => !byId.has(item.id)) || byId.size !== found.items.length) {
    throw new DomainError('VALIDATION', 'Say what condition every returned item is in.', {
      fieldErrors: { conditions: ['Choose a condition for every item.'] },
    });
  }
  for (const item of found.items) {
    await repo.setItemCondition(tx, item.id, byId.get(item.id)!);
    await repo.addReturnedQuantity(tx, item.orderItemId, item.quantity);
  }
  const effect = await inventory.restockReturn(tx, {
    returnId: found.id,
    lines: found.items.map((item) => ({
      variantId: item.orderItem.variantId,
      quantity: item.quantity,
      condition: byId.get(item.id)!,
    })),
    actorId: input.staff.userId,
  });
  await repo.patchReturn(tx, found.id, {
    status: 'inspected',
    inspectedAt: new Date(),
    ...(input.note ? { staffNote: input.note } : {}),
  });
  await markReturned(tx, {
    orderId: found.orderId,
    returnNumber: found.returnNumber,
    actor: { kind: 'staff', staffId: input.staff.staffId },
  });
  await emit(tx, found.id, found.orderId, 'inspected');
  await staffAudit(
    tx,
    input.staff,
    'return.inspect',
    found.id,
    { status: 'received' },
    {
      status: 'inspected',
      conditions: Object.fromEntries(byId),
    },
  );
  return { returnId: found.id, tags: effect.tags };
}

/** What the returned items were sold for: the default refund. */
export const returnedValueMinor = (found: ReturnDetail): bigint =>
  found.items.reduce(
    (sum, item) => sum + item.orderItem.unitPriceMinor * BigInt(item.quantity),
    0n,
  );

export interface ResolveReturnInput {
  returnId: string;
  resolution: 'refund' | 'store_credit' | 'exchange';
  /** Taka, typed by staff. Default: what the returned items were sold for. */
  amount?: string | undefined;
  refundMethod?: 'original' | 'manual_bkash' | undefined;
  providerRef?: string | undefined;
  note?: string | undefined;
  idempotencyKey: string;
  staff: ReturnStaff;
}

/**
 * Settles an inspected return. A refund or store credit goes through `processRefund` (which holds
 * the maker-checker gate); an exchange sells the replacement from free stock through the inventory
 * service and adds a priced-at-zero replacement line, so net sales are unchanged and the cost of the
 * replacement shows in the order's profit.
 */
export async function resolveReturn(tx: Tx, input: ResolveReturnInput) {
  const found = await loadLockedReturn(tx, input.returnId);
  if (found.status === 'refunded' || found.status === 'exchanged') {
    return { returnId: found.id, status: found.status, tags: [] as string[] };
  }
  if (found.status !== 'inspected') {
    throw new DomainError('CONFLICT', 'A return can be resolved once it has been inspected.');
  }
  if ((input.resolution === 'exchange') !== (found.type === 'exchange')) {
    throw new DomainError(
      'VALIDATION',
      found.type === 'exchange'
        ? 'This request is an exchange: resolve it as an exchange, or ask the customer for a refund instead.'
        : 'This request is a return: resolve it as a refund or store credit.',
    );
  }
  const tags: string[] = [];
  let status: 'refunded' | 'exchanged';

  if (input.resolution === 'exchange') {
    const sellable = await catalog.getSellableVariants(
      tx,
      found.items.map((item) => item.exchangeVariantId).filter((id): id is string => Boolean(id)),
    );
    const lines: Prisma.OrderItemCreateManyInput[] = [];
    for (const item of found.items) {
      const variant = item.exchangeVariantId ? sellable.get(item.exchangeVariantId) : undefined;
      if (!variant?.sellable || variant.avgCostMinor <= 0n) {
        throw new DomainError('CONFLICT', 'The replacement is not available any more.');
      }
      lines.push({
        orderId: found.orderId,
        variantId: variant.id,
        productId: variant.productId,
        titleSnapshot: variant.productTitle,
        variantTitleSnapshot: variant.optionsLabel,
        skuSnapshot: variant.sku,
        optionsSnapshot: variant.options as unknown as Prisma.InputJsonValue,
        imageSnapshot: variant.image?.url ?? null,
        // A swap: the customer already paid for the piece.
        unitPriceMinor: 0n,
        compareAtMinor: null,
        unitCostMinor: variant.avgCostMinor,
        quantity: item.quantity,
        discountMinor: 0n,
        taxMinor: 0n,
        totalMinor: 0n,
        replacementOfItemId: item.orderItemId,
      });
    }
    const effect = await inventory.sell(tx, {
      referenceType: 'return',
      referenceId: found.id,
      lines: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
      actorId: input.staff.userId,
    });
    tags.push(...effect.tags);
    await repo.insertReplacementLines(tx, lines);
    status = 'exchanged';
  } else {
    const amount = input.amount ?? defaultRefundText(found);
    await processRefund(tx, {
      orderId: found.orderId,
      amount,
      method:
        input.resolution === 'store_credit'
          ? 'store_credit'
          : (input.refundMethod ?? 'manual_bkash'),
      reason: `Return ${found.returnNumber}`,
      note: input.note ?? null,
      providerRef: input.providerRef ?? null,
      idempotencyKey: input.idempotencyKey,
      returnRequestId: found.id,
      staff: input.staff,
    });
    status = 'refunded';
  }

  await repo.patchReturn(tx, found.id, {
    status,
    resolution: input.resolution,
    closedAt: new Date(),
    ...(input.note ? { staffNote: input.note } : {}),
  });
  await settleReturn(tx, {
    orderId: found.orderId,
    returnNumber: found.returnNumber,
    outcome: status,
    actor: { kind: 'staff', staffId: input.staff.staffId },
    otherOpenReturn: await repo.hasOtherOpenReturn(tx, found.orderId, found.id),
  });
  await emit(tx, found.id, found.orderId, status);
  await staffAudit(
    tx,
    input.staff,
    'return.resolve',
    found.id,
    { status: 'inspected' },
    {
      status,
      resolution: input.resolution,
    },
  );
  return { returnId: found.id, status, tags };
}

/** Taka text of the returned value, for a refund form default. */
function defaultRefundText(found: ReturnDetail): string {
  return toDecimalString(money(returnedValueMinor(found), found.currency));
}

/** Closes an inspected return that needs no money or replacement (for example damaged by the customer). */
export async function closeReturn(
  tx: Tx,
  input: { returnId: string; note: string; staff: ReturnStaff },
) {
  const found = await loadLockedReturn(tx, input.returnId);
  if (found.status !== 'inspected') {
    throw new DomainError('CONFLICT', 'Only an inspected return can be closed without a refund.');
  }
  await repo.patchReturn(tx, found.id, {
    status: 'closed',
    closedAt: new Date(),
    staffNote: input.note,
  });
  await settleReturn(tx, {
    orderId: found.orderId,
    returnNumber: found.returnNumber,
    outcome: 'closed',
    actor: { kind: 'staff', staffId: input.staff.staffId },
    otherOpenReturn: await repo.hasOtherOpenReturn(tx, found.orderId, found.id),
  });
  await emit(tx, found.id, found.orderId, 'closed');
  await staffAudit(
    tx,
    input.staff,
    'return.close',
    found.id,
    { status: 'inspected' },
    {
      status: 'closed',
      note: input.note,
    },
  );
  return { returnId: found.id };
}

// Entry points (one transaction each) --------------------------------------------------------

export const requestReturnTx = (input: RequestReturnInput) =>
  db.$transaction((tx) => requestReturn(tx, input));

/**
 * A customer request from the order page: the order is found by the private tracking token and
 * only when this browser showed the second factor (the proof cookie), so nobody can open a return
 * on an order they cannot see (INV-O10).
 */
export async function requestReturnByToken(
  input: Omit<RequestReturnInput, 'orderId'> & { token: string; proof: string | undefined },
): Promise<{ returnNumber: string; orderId: string }> {
  const orderId = await orderIdForToken(input.token);
  if (!orderId || !verifyOrderProof(input.proof, orderId)) {
    throw new DomainError(
      'NOT_FOUND',
      'Please open your order again with your phone number or email.',
    );
  }
  const created = await requestReturnTx({
    orderId,
    type: input.type,
    items: input.items,
    note: input.note,
  });
  return { returnNumber: created.returnNumber, orderId };
}

// Staff entry points: one transaction each. The caller checked the permission (and the step-up
// where money moves).
export const approveReturnStaff = (input: Parameters<typeof approveReturn>[1]) =>
  db.$transaction((tx) => approveReturn(tx, input));
export const rejectReturnStaff = (input: Parameters<typeof rejectReturn>[1]) =>
  db.$transaction((tx) => rejectReturn(tx, input));
export const receiveReturnStaff = (input: Parameters<typeof receiveReturn>[1]) =>
  db.$transaction((tx) => receiveReturn(tx, input));
export const inspectReturnStaff = (input: Parameters<typeof inspectReturn>[1]) =>
  db.$transaction((tx) => inspectReturn(tx, input));
export const resolveReturnStaff = (input: ResolveReturnInput) =>
  db.$transaction((tx) => resolveReturn(tx, input));
export const closeReturnStaff = (input: Parameters<typeof closeReturn>[1]) =>
  db.$transaction((tx) => closeReturn(tx, input));
export const shipReplacementStaff = (input: Parameters<typeof shipReplacement>[1]) =>
  db.$transaction((tx) => shipReplacement(tx, input));

/** Returns of an order with their items, for the order page. */
export const returnsOfOrder = (tx: Tx, orderId: string) => repo.returnsOfOrder(tx, orderId);

/** The returns list for the admin screen. */
export async function listReturnsForAdmin(input: {
  statuses?: readonly string[];
  page: number;
  pageSize: number;
}) {
  const [rows, total] = await Promise.all([
    repo.listReturns(db, {
      ...(input.statuses ? { statuses: input.statuses } : {}),
      skip: (Math.max(1, input.page) - 1) * input.pageSize,
      take: input.pageSize,
    }),
    repo.countReturns(db, input.statuses),
  ]);
  return { rows, total };
}

export const getReturnForAdmin = (id: string) => repo.findReturn(db, id);
