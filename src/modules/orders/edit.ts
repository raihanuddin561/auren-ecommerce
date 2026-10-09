import type { Prisma } from '@/generated/prisma/client';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { enqueueEvent } from '@/lib/outbox';
import { add, money, multiply, zero, type Money } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import * as inventory from '@/modules/inventory/service';
import * as shipping from '@/modules/shipping/service';
import type { DeliveryOption } from '@/modules/shipping/quote';
import { resolveLines, type ResolvedLine } from './placement';
import * as repo from './repository';
import { assertCanAct, type Verifier } from './verification';
import type { EditOrderInput } from './schemas';
import { VERIFICATION_STATUSES } from './state-machine';
import type { OrderStatus } from './timeline';
import type { ShippingAddressSnapshot, ShippingMethodSnapshot } from './types';

/**
 * Changing an order while a person verifies it with the customer (6.14): size, colour or quantity,
 * lines added or removed, a corrected address. The server re-prices with the same rules as
 * checkout (prices and costs from the database, no cost basis means refused, stock through the
 * inventory service so nothing can oversell), keeps the price the customer agreed to on lines that
 * stay, re-quotes delivery, and writes the timeline, audit and outbox rows. The order stays in its
 * verification status: the person then confirms it with the checklist as usual. After
 * confirmation the database refuses any change to lines and totals.
 */

export interface EditOrderCommand extends EditOrderInput {
  verifier: Verifier;
}

export interface EditOrderResult {
  orderId: string;
  totalChanged: boolean;
  totalBeforeMinor: bigint;
  totalAfterMinor: bigint;
  /** Stock cache tags to invalidate. */
  tags: string[];
}

const squashed = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

export async function editOrder(tx: Tx, input: EditOrderCommand): Promise<EditOrderResult> {
  const { verifier } = input;
  if (!(await repo.lockOrder(tx, input.orderId))) {
    throw new DomainError('NOT_FOUND', 'Order not found');
  }
  const order = await repo.findById(tx, input.orderId);
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found');
  const status = order.status as OrderStatus;
  if (!(VERIFICATION_STATUSES as readonly string[]).includes(status)) {
    throw new DomainError(
      'CONFLICT',
      'An order can be changed only while it waits for verification. Cancel it and place a new one, or use a return.',
    );
  }
  await assertCanAct(tx, order, verifier, new Date());

  // --- the lines the order should have -------------------------------------------------------
  const existingById = new Map(order.items.map((item) => [item.id, item]));
  const kept = new Set<string>();
  const wanted: Array<{ itemId: string | null; variantId: string; quantity: number }> = [];
  for (const line of input.lines) {
    if (line.itemId) {
      const item = existingById.get(line.itemId);
      if (!item || kept.has(line.itemId)) {
        throw new DomainError('VALIDATION', 'One of the lines is not part of this order.', {
          fieldErrors: { lines: ['Reload the order and try again.'] },
        });
      }
      kept.add(line.itemId);
      wanted.push({ itemId: item.id, variantId: line.variantId, quantity: line.quantity });
    } else {
      wanted.push({ itemId: null, variantId: line.variantId, quantity: line.quantity });
    }
  }
  const variantIds = wanted.map((line) => line.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new DomainError('VALIDATION', 'Each variant can appear on one line only.', {
      fieldErrors: { lines: ['Combine the quantities of the same size and colour into one line.'] },
    });
  }

  // A line that keeps its item and variant keeps its snapshot (price and cost the customer agreed to).
  const toResolve = wanted.filter((line) => {
    const item = line.itemId ? existingById.get(line.itemId) : undefined;
    return !item || item.variantId !== line.variantId;
  });
  const resolved = new Map<string, ResolvedLine>(
    (
      await resolveLines(
        tx,
        toResolve.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        { currency: order.currency, checkAvailability: false },
      )
    ).map((line) => [line.variant.id, line]),
  );

  // --- stock: only the difference moves ------------------------------------------------------
  const before = new Map<string, number>();
  for (const item of order.items) {
    before.set(item.variantId, (before.get(item.variantId) ?? 0) + item.quantity);
  }
  const after = new Map<string, number>();
  for (const line of wanted) after.set(line.variantId, line.quantity);
  const takes: Array<{ variantId: string; quantity: number }> = [];
  const gives: Array<{ variantId: string; quantity: number }> = [];
  for (const variantId of new Set([...before.keys(), ...after.keys()])) {
    const delta = (after.get(variantId) ?? 0) - (before.get(variantId) ?? 0);
    if (delta > 0) takes.push({ variantId, quantity: delta });
    if (delta < 0) gives.push({ variantId, quantity: -delta });
  }
  const tags = new Set<string>();
  if (gives.length > 0) {
    const effect = await inventory.restock(tx, {
      referenceType: 'order',
      referenceId: order.id,
      lines: gives,
      reason: 'order_edited',
      actorId: verifier.userId,
    });
    for (const tag of effect.tags) tags.add(tag);
  }
  if (takes.length > 0) {
    // The same atomic conditional update as checkout: short stock fails the whole edit.
    const effect = await inventory.sell(tx, {
      referenceType: 'order',
      referenceId: order.id,
      lines: takes,
      actorId: verifier.userId,
    });
    for (const tag of effect.tags) tags.add(tag);
  }

  // --- write the lines -----------------------------------------------------------------------
  const removed = order.items.filter((item) => !kept.has(item.id));
  if (removed.length > 0)
    await repo.deleteItems(
      tx,
      removed.map((item) => item.id),
    );
  const newLines: Prisma.OrderItemCreateManyInput[] = [];
  let subtotal = zero(order.currency);
  for (const line of wanted) {
    const item = line.itemId ? existingById.get(line.itemId) : undefined;
    if (item && item.variantId === line.variantId) {
      const unit = money(item.unitPriceMinor, order.currency);
      const total = multiply(unit, line.quantity);
      subtotal = add(subtotal, total);
      if (item.quantity !== line.quantity) {
        await repo.updateItem(tx, item.id, { quantity: line.quantity, totalMinor: total.minor });
      }
      continue;
    }
    const fresh = resolved.get(line.variantId);
    if (!fresh) throw new DomainError('INTERNAL', 'A line could not be priced.');
    const { variant } = fresh;
    const unit = money(variant.priceMinor, variant.currency);
    const total = multiply(unit, line.quantity);
    subtotal = add(subtotal, total);
    if (item) await repo.deleteItems(tx, [item.id]);
    newLines.push({
      orderId: order.id,
      variantId: variant.id,
      productId: variant.productId,
      titleSnapshot: variant.productTitle,
      variantTitleSnapshot: variant.optionsLabel,
      skuSnapshot: variant.sku,
      optionsSnapshot: variant.options as unknown as Prisma.InputJsonValue,
      imageSnapshot: variant.image?.url ?? null,
      unitPriceMinor: unit.minor,
      compareAtMinor: variant.compareAtMinor,
      unitCostMinor: variant.avgCostMinor,
      quantity: line.quantity,
      discountMinor: 0n,
      taxMinor: 0n,
      totalMinor: total.minor,
    });
  }
  if (newLines.length > 0) await repo.insertItems(tx, newLines);

  // --- address and delivery ------------------------------------------------------------------
  const oldAddress = order.shippingAddress as unknown as ShippingAddressSnapshot;
  const oldMethod = order.shippingMethod as unknown as ShippingMethodSnapshot;
  let address = oldAddress;
  let addressChanged = false;
  if (input.address) {
    const area = await shipping.resolveArea(tx, {
      divisionId: input.address.divisionId,
      districtId: input.address.districtId,
      divisionName: input.address.divisionName,
      districtName: input.address.districtName,
      thanaId: input.address.thanaId ?? null,
      thanaName: input.address.thanaName,
    });
    address = {
      fullName: oldAddress.fullName,
      phone: oldAddress.phone,
      division: area.division,
      district: area.district,
      thana: {
        id: area.thana?.id ?? null,
        name: area.thana?.name ?? input.address.thanaName?.trim() ?? input.address.area,
      },
      area: input.address.area,
      line1: input.address.line1,
      line2: input.address.line2 ?? null,
      postalCode: input.address.postalCode ?? null,
      country: 'BD',
    };
    addressChanged = squashed(JSON.stringify(address)) !== squashed(JSON.stringify(oldAddress));
    // The delivery area may have changed: quote again, keeping the delivery method the customer chose when it still exists.
    const quote = await shipping.quoteDelivery(tx, area, subtotal);
    const option: DeliveryOption =
      quote.options.find((candidate) => candidate.name === oldMethod.rateName) ?? quote.options[0]!;
    await patchDelivery(tx, order.id, quote.zoneId, quote.zoneName, option, address);
    return finish(tx, {
      order,
      subtotal,
      shippingCharged: option.charge,
      addressChanged,
      before,
      after,
      tags,
      verifier,
      note: input.note ?? null,
    });
  }
  // Same address: delivery is re-quoted for the new subtotal (a free-delivery threshold may now apply or not).
  const area = await shipping.resolveArea(tx, {
    divisionId: oldAddress.division.id,
    districtId: oldAddress.district.id,
    divisionName: oldAddress.division.name,
    districtName: oldAddress.district.name,
    thanaId:
      oldAddress.thana.id && !oldAddress.thana.id.startsWith('manual') ? oldAddress.thana.id : null,
    thanaName: oldAddress.thana.name,
  });
  const quote = await shipping.quoteDelivery(tx, area, subtotal);
  const option: DeliveryOption =
    quote.options.find((candidate) => candidate.rateId === oldMethod.rateId) ??
    quote.options.find((candidate) => candidate.name === oldMethod.rateName) ??
    quote.options[0]!;
  await patchDelivery(tx, order.id, quote.zoneId, quote.zoneName, option, address);
  return finish(tx, {
    order,
    subtotal,
    shippingCharged: option.charge,
    addressChanged,
    before,
    after,
    tags,
    verifier,
    note: input.note ?? null,
  });
}

async function patchDelivery(
  tx: Tx,
  orderId: string,
  zoneId: string,
  zoneName: string,
  option: DeliveryOption,
  address: ShippingAddressSnapshot,
): Promise<void> {
  const method: ShippingMethodSnapshot = {
    zoneId,
    zoneName,
    rateId: option.rateId,
    rateName: option.name,
    listedMinor: option.listed.minor.toString(),
    chargedMinor: option.charge.minor.toString(),
    freeOverMinor: option.freeOver ? option.freeOver.minor.toString() : null,
    free: option.free,
    minDays: option.minDays,
    maxDays: option.maxDays,
  };
  await repo.patchOrder(tx, orderId, {
    shippingAddress: address as unknown as Prisma.InputJsonValue,
    shippingMethod: method as unknown as Prisma.InputJsonValue,
  });
}

interface FinishInput {
  order: NonNullable<Awaited<ReturnType<typeof repo.findById>>>;
  subtotal: Money;
  shippingCharged: Money;
  addressChanged: boolean;
  before: Map<string, number>;
  after: Map<string, number>;
  tags: Set<string>;
  verifier: Verifier;
  note: string | null;
}

async function finish(tx: Tx, input: FinishInput): Promise<EditOrderResult> {
  const { order, verifier } = input;
  const total = add(input.subtotal, input.shippingCharged);
  const totalChanged = total.minor !== order.totalMinor;
  await repo.patchOrder(tx, order.id, {
    subtotalMinor: input.subtotal.minor,
    shippingChargedMinor: input.shippingCharged.minor,
    totalMinor: total.minor,
  });
  // The cash on delivery payment follows the new total (nothing was collected yet).
  await repo.syncPendingPaymentAmount(tx, order.id, total.minor);
  await repo.insertAttempt(tx, {
    orderId: order.id,
    staffId: verifier.staffId,
    channel: 'call',
    outcome: 'order_edited',
    note: input.note,
  });
  const summary = (map: Map<string, number>) =>
    Object.fromEntries([...map].map(([variantId, quantity]) => [variantId, quantity]));
  await repo.insertEvent(tx, {
    orderId: order.id,
    type: 'order_edited',
    actorId: verifier.staffId,
    payload: {
      totalBeforeMinor: order.totalMinor.toString(),
      totalAfterMinor: total.minor.toString(),
      addressChanged: input.addressChanged,
      linesBefore: summary(input.before),
      linesAfter: summary(input.after),
      ...(input.note ? { note: input.note } : {}),
    },
  });
  await audit(tx, {
    actorId: verifier.userId,
    action: 'order.edit',
    entity: 'order',
    entityId: order.id,
    before: { totalMinor: order.totalMinor.toString(), lines: summary(input.before) },
    after: {
      totalMinor: total.minor.toString(),
      lines: summary(input.after),
      addressChanged: input.addressChanged,
    },
    ip: verifier.ip ?? null,
    userAgent: verifier.userAgent ?? null,
  });
  await enqueueEvent(tx, {
    type: 'order.updated',
    aggregateType: 'order',
    aggregateId: order.id,
    payload: { orderId: order.id, totalChanged },
  });
  return {
    orderId: order.id,
    totalChanged,
    totalBeforeMinor: order.totalMinor,
    totalAfterMinor: total.minor,
    tags: [...input.tags],
  };
}

export const editOrderStaff = (input: EditOrderCommand) =>
  db.$transaction((tx) => editOrder(tx, input));
