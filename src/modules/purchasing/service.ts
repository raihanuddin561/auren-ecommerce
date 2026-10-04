import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { runIdempotent } from '@/lib/idempotency';
import { fromDecimalString, money, multiply, add, zero } from '@/lib/money';
import { enqueueEvent } from '@/lib/outbox';
import { audit } from '@/modules/audit/service';
import * as catalog from '@/modules/catalog/service';
import * as inventory from '@/modules/inventory/service';
import {
  allocateLandedCosts,
  landedUnitCost,
  receiptLandedShare,
  receiptValue,
  weightedAverageCost,
  type CostLine,
} from './cost';
import {
  assertPoTransition,
  canAddLandedCost,
  canReceive,
  isEditable,
  statusAfterReceipt,
  type PoStatus,
} from './po-state';
import * as repo from './repository';
import type {
  AddLandedCostInput,
  CreatePurchaseOrderInput,
  ReceiveGoodsInput,
  SupplierFields,
  UpdatePurchaseOrderInput,
  UpdateSupplierInput,
} from './schemas';

/** Currency of every purchase order for now: the base currency (ARCHITECTURE section 8). */
const PO_CURRENCY = 'BDT';

export interface PurchasingActor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** What a mutation returns: its data and the cache tags the caller must invalidate. */
export interface Mutation<T> {
  data: T;
  tags: string[];
}

const auditBase = (actor: PurchasingActor) => ({
  actorId: actor.userId,
  ip: actor.ip ?? null,
  userAgent: actor.userAgent ?? null,
});

const clean = <T extends Record<string, unknown>>(fields: T) =>
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value ?? null]));

// ---------------------------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------------------------

export async function createSupplier(
  input: SupplierFields,
  actor: PurchasingActor,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const supplier = await repo.createSupplier(tx, { ...input, ...clean(input) });
    await audit(tx, {
      ...auditBase(actor),
      action: 'supplier.create',
      entity: 'supplier',
      entityId: supplier.id,
      after: { id: supplier.id, name: supplier.name, isActive: supplier.isActive },
    });
    return { data: { id: supplier.id }, tags: [] };
  });
}

export async function updateSupplier(
  input: UpdateSupplierInput,
  actor: PurchasingActor,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const before = await repo.findSupplier(tx, input.id);
    if (!before) throw new DomainError('NOT_FOUND', 'That supplier does not exist.');
    const { id, ...fields } = input;
    const after = await repo.updateSupplier(tx, id, clean(fields));
    await audit(tx, {
      ...auditBase(actor),
      action: before.isActive === after.isActive ? 'supplier.update' : 'supplier.set_active',
      entity: 'supplier',
      entityId: id,
      before: { name: before.name, isActive: before.isActive },
      after: { name: after.name, isActive: after.isActive },
    });
    return { data: { id }, tags: [] };
  });
}

// ---------------------------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------------------------

async function toLines(
  tx: Tx,
  lines: ReadonlyArray<{ variantId: string; quantityOrdered: number; unitCost: string }>,
) {
  const known = await catalog.productIdsForVariants(
    tx,
    lines.map((line) => line.variantId),
  );
  return lines.map((line) => {
    if (!known.has(line.variantId)) {
      throw new DomainError('NOT_FOUND', 'One of the variants does not exist.');
    }
    return {
      variantId: line.variantId,
      quantityOrdered: line.quantityOrdered,
      unitCostMinor: fromDecimalString(line.unitCost, PO_CURRENCY).minor,
    };
  });
}

const expectedDate = (value?: string) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

async function requireActiveSupplier(tx: Tx, supplierId: string) {
  const supplier = await repo.findSupplier(tx, supplierId);
  if (!supplier) throw new DomainError('NOT_FOUND', 'That supplier does not exist.');
  if (!supplier.isActive) throw new DomainError('CONFLICT', 'That supplier is inactive.');
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  actor: PurchasingActor,
): Promise<Mutation<{ id: string; poNumber: string }>> {
  return db.$transaction(async (tx) => {
    await requireActiveSupplier(tx, input.supplierId);
    const items = await toLines(tx, input.lines);
    const po = await repo.createPurchaseOrder(tx, {
      supplierId: input.supplierId,
      currency: PO_CURRENCY,
      expectedAt: expectedDate(input.expectedAt),
      notes: input.notes ?? null,
      createdBy: actor.userId,
    });
    await repo.replaceItems(tx, po.id, items);
    await audit(tx, {
      ...auditBase(actor),
      action: 'purchase_order.create',
      entity: 'purchase_order',
      entityId: po.id,
      after: { poNumber: po.poNumber, supplierId: po.supplierId, lines: items.length },
    });
    return { data: { id: po.id, poNumber: po.poNumber }, tags: [] };
  });
}

/** Fails when the landed costs on the order could not be spread over its (new) lines. */
async function assertAllocatable(tx: Tx, poId: string, currency: string): Promise<void> {
  const costs = (await repo.listLandedCosts(tx, poId)).map((cost) => ({
    amountMinor: cost.amountMinor,
    method: cost.allocationMethod,
  }));
  try {
    allocateLandedCosts(await costLines(tx, poId), costs, currency);
  } catch (error) {
    throw new DomainError(
      'VALIDATION',
      error instanceof Error
        ? error.message
        : 'The landed costs cannot be spread over these lines.',
    );
  }
}

async function lockInStatus(
  tx: Tx,
  id: string,
  allowed: (status: PoStatus) => boolean,
  message: string,
) {
  const po = await repo.lockPurchaseOrder(tx, id);
  if (!po) throw new DomainError('NOT_FOUND', 'That purchase order does not exist.');
  if (!allowed(po.status as PoStatus)) throw new DomainError('INVALID_TRANSITION', message);
  return { ...po, status: po.status as PoStatus };
}

export async function updatePurchaseOrder(
  input: UpdatePurchaseOrderInput,
  actor: PurchasingActor,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const po = await lockInStatus(tx, input.id, isEditable, 'Only a draft order can be edited.');
    await requireActiveSupplier(tx, input.supplierId);
    const items = await toLines(tx, input.lines);
    await repo.updatePurchaseOrder(tx, input.id, {
      supplierId: input.supplierId,
      expectedAt: expectedDate(input.expectedAt),
      notes: input.notes ?? null,
    });
    await repo.replaceItems(tx, input.id, items);
    await assertAllocatable(tx, input.id, po.currency);
    await audit(tx, {
      ...auditBase(actor),
      action: 'purchase_order.update',
      entity: 'purchase_order',
      entityId: input.id,
      after: { supplierId: input.supplierId, lines: items.length },
    });
    return { data: { id: input.id }, tags: [] };
  });
}

/** Sends the order to the supplier: draft becomes ordered and can no longer be edited. */
export async function placeOrder(
  id: string,
  actor: PurchasingActor,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const po = await lockInStatus(
      tx,
      id,
      (s) => s === 'draft',
      'Only a draft order can be placed.',
    );
    assertPoTransition(po.status, 'ordered');
    await requireActiveSupplier(tx, po.supplierId);
    if ((await repo.listItems(tx, id)).length === 0) {
      throw new DomainError('VALIDATION', 'Add at least one line first.');
    }
    await assertAllocatable(tx, id, po.currency);
    await repo.updatePurchaseOrder(tx, id, { status: 'ordered', orderedAt: new Date() });
    await audit(tx, {
      ...auditBase(actor),
      action: 'purchase_order.place',
      entity: 'purchase_order',
      entityId: id,
      before: { status: 'draft' },
      after: { status: 'ordered' },
    });
    return { data: { id }, tags: [] };
  });
}

/** Cancels an order nothing has arrived for. */
export async function cancelPurchaseOrder(
  id: string,
  reason: string | undefined,
  actor: PurchasingActor,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const po = await lockInStatus(
      tx,
      id,
      (s) => s === 'draft' || s === 'ordered',
      'An order that has received goods cannot be cancelled.',
    );
    assertPoTransition(po.status, 'cancelled');
    if ((await repo.countReceivedUnits(tx, id)) > 0) {
      throw new DomainError(
        'INVALID_TRANSITION',
        'An order that has received goods cannot be cancelled.',
      );
    }
    await repo.updatePurchaseOrder(tx, id, { status: 'cancelled' });
    await audit(tx, {
      ...auditBase(actor),
      action: 'purchase_order.cancel',
      entity: 'purchase_order',
      entityId: id,
      before: { status: po.status },
      after: { status: 'cancelled', reason: reason ?? null },
    });
    return { data: { id }, tags: [] };
  });
}

// ---------------------------------------------------------------------------------------------
// Landed costs
// ---------------------------------------------------------------------------------------------

async function costLines(tx: Tx, poId: string): Promise<CostLine[]> {
  return (await repo.listItems(tx, poId)).map((item) => ({
    id: item.id,
    quantityOrdered: item.quantityOrdered,
    unitCostMinor: item.unitCostMinor,
  }));
}

/** Adds freight, duty or another cost; it is spread over the lines by quantity or value. */
export async function addLandedCost(
  input: AddLandedCostInput,
  actor: PurchasingActor,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const po = await lockInStatus(
      tx,
      input.poId,
      canAddLandedCost,
      'Costs can be added until the first delivery is received.',
    );
    if ((await repo.countReceivedUnits(tx, input.poId)) > 0) {
      throw new DomainError(
        'INVALID_TRANSITION',
        'Costs can be added until the first delivery is received.',
      );
    }
    const amountMinor = fromDecimalString(input.amount, po.currency).minor;
    if (amountMinor <= 0n) throw new DomainError('VALIDATION', 'Enter an amount above zero.');
    const lines = await costLines(tx, input.poId);
    try {
      // Proves the cost can be spread over this order before it is stored.
      allocateLandedCosts(lines, [{ amountMinor, method: input.method }], po.currency);
    } catch (error) {
      throw new DomainError(
        'VALIDATION',
        error instanceof Error ? error.message : 'Cannot spread this cost.',
      );
    }
    const cost = await repo.createLandedCost(tx, {
      poId: input.poId,
      type: input.type,
      amountMinor,
      allocationMethod: input.method,
      note: input.note ?? null,
    });
    await audit(tx, {
      ...auditBase(actor),
      action: 'landed_cost.add',
      entity: 'purchase_order',
      entityId: input.poId,
      after: { type: input.type, amountMinor, method: input.method },
    });
    return { data: { id: cost.id }, tags: [] };
  });
}

/** Removes a cost, only while nothing has been received (received units already carry it). */
export async function removeLandedCost(
  id: string,
  actor: PurchasingActor,
): Promise<Mutation<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const cost = await repo.findLandedCost(tx, id);
    if (!cost) throw new DomainError('NOT_FOUND', 'That cost does not exist.');
    await lockInStatus(
      tx,
      cost.poId,
      (s) => s === 'draft' || s === 'ordered',
      'Costs cannot be removed after goods have been received.',
    );
    if ((await repo.countReceivedUnits(tx, cost.poId)) > 0) {
      throw new DomainError(
        'INVALID_TRANSITION',
        'Costs cannot be removed after goods have been received.',
      );
    }
    await repo.deleteLandedCost(tx, id);
    await audit(tx, {
      ...auditBase(actor),
      action: 'landed_cost.remove',
      entity: 'purchase_order',
      entityId: cost.poId,
      before: { type: cost.type, amountMinor: cost.amountMinor, method: cost.allocationMethod },
    });
    return { data: { id }, tags: [] };
  });
}

// ---------------------------------------------------------------------------------------------
// Goods receipt
// ---------------------------------------------------------------------------------------------

export interface ReceiptOutcome {
  receiptId: string;
  status: 'partially_received' | 'received';
  /** Variants whose stock changed, to invalidate caches. */
  tags: string[];
  [key: string]: string | string[];
}

/**
 * Receives a delivery, in full or in part, in one transaction: locks the order and the variants,
 * writes the receipt and its lines, adds stock through the inventory service (receipt movements),
 * recalculates each variant's weighted average landed cost and moves the order status. Submitting
 * the same idempotency key again returns the first result instead of receiving twice.
 */
export async function receiveGoods(
  input: ReceiveGoodsInput,
  actor: PurchasingActor,
): Promise<Mutation<{ receiptId: string; status: string; replayed: boolean }>> {
  const { replayed, value } = await runIdempotent<ReceiptOutcome>(
    db,
    {
      key: input.idempotencyKey,
      scope: 'purchasing.receive',
      actor: actor.userId,
      request: {
        poId: input.poId,
        locationId: input.locationId ?? null,
        notes: input.notes ?? null,
        lines: [...input.lines].sort((a, b) => (a.poItemId < b.poItemId ? -1 : 1)),
      },
    },
    (tx) => receiveInTransaction(tx, input, actor),
  );
  return {
    data: { receiptId: value.receiptId, status: value.status, replayed },
    tags: replayed ? [] : value.tags,
  };
}

async function receiveInTransaction(
  tx: Tx,
  input: ReceiveGoodsInput,
  actor: PurchasingActor,
): Promise<ReceiptOutcome> {
  const po = await lockInStatus(
    tx,
    input.poId,
    canReceive,
    'Goods can be received once the order is placed and until everything has arrived.',
  );
  const items = await repo.listItems(tx, input.poId);
  const byId = new Map(items.map((item) => [item.id, item]));
  const costs = (await repo.listLandedCosts(tx, input.poId)).map((cost) => ({
    amountMinor: cost.amountMinor,
    method: cost.allocationMethod,
  }));
  const allocation = allocateLandedCosts(
    items.map((item) => ({
      id: item.id,
      quantityOrdered: item.quantityOrdered,
      unitCostMinor: item.unitCostMinor,
    })),
    costs,
    po.currency,
  );

  const requested = input.lines.map((line) => {
    const item = byId.get(line.poItemId);
    if (!item) throw new DomainError('NOT_FOUND', 'A line does not belong to this order.');
    const outstanding = item.quantityOrdered - item.quantityReceived;
    if (line.quantity > outstanding) {
      throw new DomainError('VALIDATION', 'You cannot receive more than is outstanding.', {
        fieldErrors: { lines: [`Only ${outstanding} units are outstanding on one line.`] },
      });
    }
    return { item, quantity: line.quantity };
  });
  // Stable order: concurrent receipts of the same variants lock rows the same way.
  requested.sort((a, b) =>
    a.item.variantId < b.item.variantId ? -1 : a.item.variantId > b.item.variantId ? 1 : 0,
  );

  const variantCosts = await catalog.lockVariantCosts(
    tx,
    requested.map((entry) => entry.item.variantId),
  );
  const locationId = input.locationId;
  const receipt = await repo.createReceipt(tx, {
    poId: input.poId,
    locationId: locationId ?? (await defaultLocation(tx)),
    receivedBy: actor.userId,
    notes: input.notes ?? null,
  });

  const stockEffects: string[] = [];
  for (const { item, quantity } of requested) {
    const variant = variantCosts.get(item.variantId);
    if (!variant) throw new DomainError('NOT_FOUND', 'A variant on this order no longer exists.');
    if (variant.currency !== po.currency) {
      throw new DomainError(
        'VALIDATION',
        'A variant is priced in another currency than this order.',
      );
    }
    const alreadyCarried = await repo.landedAllocatedBefore(tx, item.id);
    const landedMinor = receiptLandedShare({
      lineLandedMinor: allocation.perLine.get(item.id) ?? 0n,
      quantityOrdered: item.quantityOrdered,
      receivedAfter: item.quantityReceived + quantity,
      alreadyAllocatedMinor: alreadyCarried,
      currency: po.currency,
    });
    const delivery = { quantity, unitCostMinor: item.unitCostMinor, landedMinor };
    if (!(await repo.addReceivedQuantity(tx, item.id, quantity))) {
      throw new DomainError('VALIDATION', 'You cannot receive more than is outstanding.');
    }
    await repo.createReceiptItem(tx, {
      receiptId: receipt.id,
      poItemId: item.id,
      quantity,
      unitCostMinor: item.unitCostMinor,
      landedCostMinor: landedMinor,
    });
    const stock = await inventory.receive(tx, {
      variantId: item.variantId,
      locationId: receipt.locationId,
      quantity,
      unitCostMinor: landedUnitCost(delivery, po.currency),
      referenceType: 'goods_receipt',
      referenceId: receipt.id,
      actorId: actor.userId,
    });
    const average = weightedAverageCost({
      onHandBefore: stock.onHandBefore,
      avgCostBeforeMinor: variant.avgCostMinor,
      receivedQuantity: quantity,
      incomingValueMinor: receiptValue(delivery, po.currency).minor,
    });
    await catalog.setVariantAverageCost(tx, item.variantId, average);
    stockEffects.push(item.variantId);
  }

  const after = await repo.listItems(tx, input.poId);
  const status = statusAfterReceipt(after);
  assertPoTransition(po.status, status);
  await repo.updatePurchaseOrder(tx, input.poId, { status });
  await audit(tx, {
    ...auditBase(actor),
    action: 'purchase_order.receive',
    entity: 'purchase_order',
    entityId: input.poId,
    before: { status: po.status },
    after: {
      status,
      receiptId: receipt.id,
      units: requested.reduce((sum, entry) => sum + entry.quantity, 0),
    },
  });
  await enqueueEvent(tx, {
    type: 'purchase_order.received',
    aggregateType: 'purchase_order',
    aggregateId: input.poId,
    payload: {
      purchaseOrderId: input.poId,
      receiptId: receipt.id,
      complete: status === 'received',
    },
  });
  const effect = await inventory.effectFor(tx, stockEffects);
  return { receiptId: receipt.id, status, tags: effect.tags };
}

async function defaultLocation(tx: Tx): Promise<string> {
  const location = await tx.location.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (!location) throw new DomainError('CONFLICT', 'There is no active stock location.');
  return location.id;
}

// ---------------------------------------------------------------------------------------------
// Totals shared by the screens and the PDF
// ---------------------------------------------------------------------------------------------

export interface OrderTotals {
  goodsMinor: bigint;
  landedMinor: bigint;
  totalMinor: bigint;
  /** Landed cost per line (whole order), keyed by purchase_order_items.id. */
  landedPerLine: Map<string, bigint>;
}

export function orderTotals(
  items: ReadonlyArray<{ id: string; quantityOrdered: number; unitCostMinor: bigint }>,
  costs: ReadonlyArray<{ amountMinor: bigint; allocationMethod: 'by_quantity' | 'by_value' }>,
  currency: string,
): OrderTotals {
  const goods = items.reduce(
    (acc, item) => add(acc, multiply(money(item.unitCostMinor, currency), item.quantityOrdered)),
    zero(currency),
  );
  const allocation = allocateLandedCosts(
    items,
    costs.map((cost) => ({ amountMinor: cost.amountMinor, method: cost.allocationMethod })),
    currency,
  );
  return {
    goodsMinor: goods.minor,
    landedMinor: allocation.total,
    totalMinor: goods.minor + allocation.total,
    landedPerLine: allocation.perLine,
  };
}

/** Variant search for the purchase order form. */
export const searchVariantsForOrder = (q: string) => inventory.searchVariants(q);

/** Human labels for variants (order screens), through the catalog service. */
export const variantLabels = (variantIds: readonly string[]) =>
  catalog.variantLabels(db, variantIds);
