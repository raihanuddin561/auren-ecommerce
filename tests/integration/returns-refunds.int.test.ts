import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { isDomainError } from '@/lib/errors';
import { toPermissionSet, type StaffContext } from '@/lib/permissions';
import { requestApproval, decideApproval } from '@/modules/approvals/service';
import { getOrderProfit } from '@/modules/finance/service';
import { findLedgerMismatches, receive } from '@/modules/inventory/service';
import { processRefund } from '@/modules/payments/refunds';
import {
  approveReturn,
  closeReturn,
  inspectReturn,
  receiveReturn,
  rejectReturn,
  requestReturn,
  resolveReturn,
} from '@/modules/returns/service';
import { makeCustomer, makeStaff } from '../factories';
import { deliveredOrder, makeSellableVariant, seedDelivery } from './commerce-helpers';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  await seedDelivery();
});
afterAll(closeDatabase);

async function errorOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    return isDomainError(error)
      ? `${error.code}: ${error.message}`
      : `unexpected: ${String(error)}`;
  }
  return 'no error';
}

const inTx = <T>(work: Parameters<typeof db.$transaction>[0]) =>
  db.$transaction(work as never) as Promise<T>;

async function manager() {
  const made = await makeStaff({ role: 'manager' });
  const context: StaffContext = {
    id: made.member.id,
    userId: made.member.userId,
    role: 'manager',
    name: 'Manager',
    email: made.email,
    permissions: toPermissionSet(['approvals.decide', 'orders.refund', 'returns.manage']),
  };
  return { ...made, context, staff: { staffId: made.member.id, userId: made.member.userId } };
}

const itemsOf = (orderId: string) => db.orderItem.findMany({ where: { orderId } });
const onHand = async (variantId: string) =>
  (await db.inventoryLevel.findFirstOrThrow({ where: { variantId } })).onHand;

describe('return window and request rules (6.12)', () => {
  it('opens a return for a delivered order and moves the order to return_requested', async () => {
    const { orderId } = await deliveredOrder({ quantity: 2 });
    const [item] = await itemsOf(orderId);
    const result = await inTx<{ returnNumber: string }>((tx) =>
      requestReturn(tx, {
        orderId,
        type: 'return',
        items: [{ orderItemId: item!.id, quantity: 1, reason: 'too_small' }],
        note: 'It is a bit tight',
      }),
    );
    expect(result.returnNumber).toMatch(/^RET-\d{4,}$/);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      'return_requested',
    );
    expect(
      await db.outboxEvent.count({
        where: { type: 'return.status_changed', aggregateType: 'return' },
      }),
    ).toBe(1);
  });

  it('refuses outside the window (7 days from delivery), before delivery, too many units and a second open request', async () => {
    const { orderId } = await deliveredOrder({ quantity: 2 });
    const [item] = await itemsOf(orderId);
    const ask = (quantity: number, now?: Date) =>
      inTx((tx) =>
        requestReturn(tx, {
          orderId,
          type: 'return',
          items: [{ orderItemId: item!.id, quantity, reason: 'changed_mind' }],
          ...(now ? { now } : {}),
        }),
      );
    expect(await errorOf(ask(1, new Date(Date.now() + 8 * 24 * 3600 * 1000)))).toMatch(
      /^CONFLICT: The 7-day return window ended on/,
    );
    expect(await errorOf(ask(3))).toMatch(/^VALIDATION: You can return up to 2/);
    await ask(1);
    expect(await errorOf(ask(1))).toMatch(/^CONFLICT: You already have a return in progress/);
    // An order that was never delivered cannot be returned.
    const variant = await makeSellableVariant({ stock: 3 });
    const { placeTestOrder } = await import('./commerce-helpers');
    const fresh = await placeTestOrder({ variant });
    const [line] = await itemsOf(fresh.orderId);
    expect(
      await errorOf(
        inTx((tx) =>
          requestReturn(tx, {
            orderId: fresh.orderId,
            type: 'return',
            items: [{ orderItemId: line!.id, quantity: 1, reason: 'changed_mind' }],
          }),
        ),
      ),
    ).toMatch(/^CONFLICT: A return can be requested once your order has been delivered/);
  });

  it('a rejected request puts the order back to delivered', async () => {
    const { orderId } = await deliveredOrder({ quantity: 1 });
    const [item] = await itemsOf(orderId);
    const { returnId } = await inTx<{ returnId: string }>((tx) =>
      requestReturn(tx, {
        orderId,
        type: 'return',
        items: [{ orderItemId: item!.id, quantity: 1, reason: 'changed_mind' }],
      }),
    );
    const staff = await manager();
    await inTx((tx) =>
      rejectReturn(tx, { returnId, reason: 'Worn and washed', staff: staff.staff }),
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('delivered');
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: returnId } })).status).toBe(
      'rejected',
    );
    // The customer can ask again for the same unit: nothing is spoken for.
    await inTx((tx) =>
      requestReturn(tx, {
        orderId,
        type: 'return',
        items: [{ orderItemId: item!.id, quantity: 1, reason: 'changed_mind' }],
      }),
    );
  });
});

describe('return, inspection, restock and refund (6.12, 5.5)', () => {
  async function inspected(options: { quantity: number; returned: number; damaged?: number }) {
    // 2,000 a unit keeps a whole-order refund under the 5,000 approval threshold.
    const delivered = await deliveredOrder({
      quantity: options.quantity,
      stock: 10,
      priceMinor: 200000n,
    });
    const [item] = await itemsOf(delivered.orderId);
    const { returnId } = await inTx<{ returnId: string }>((tx) =>
      requestReturn(tx, {
        orderId: delivered.orderId,
        type: 'return',
        items: [{ orderItemId: item!.id, quantity: options.returned, reason: 'too_large' }],
      }),
    );
    const staff = await manager();
    await inTx((tx) => approveReturn(tx, { returnId, staff: staff.staff }));
    await inTx((tx) =>
      receiveReturn(tx, { returnId, shippingCostMinor: 8000n, staff: staff.staff }),
    );
    const returnItem = await db.returnItem.findFirstOrThrow({ where: { returnId } });
    await inTx((tx) =>
      inspectReturn(tx, {
        returnId,
        conditions: [
          { returnItemId: returnItem.id, condition: options.damaged ? 'damaged' : 'resellable' },
        ],
        staff: staff.staff,
      }),
    );
    return { ...delivered, returnId, manager: staff, itemId: item!.id };
  }

  it('resellable goods go back on the shelf, the whole order is refunded and the numbers add up', async () => {
    const ctx = await inspected({ quantity: 2, returned: 2 });
    // 10 in stock, 2 sold: 8. The two came back: 10.
    expect(await onHand(ctx.variant.variantId)).toBe(10);
    expect(await findLedgerMismatches(ctx.variant.variantId)).toEqual([]);
    expect((await db.order.findUniqueOrThrow({ where: { id: ctx.orderId } })).status).toBe(
      'returned',
    );
    expect(
      (await db.orderItem.findUniqueOrThrow({ where: { id: ctx.itemId } })).quantityReturned,
    ).toBe(2);
    const costLine = await db.orderCostLine.findFirstOrThrow({
      where: { orderId: ctx.orderId, type: 'return_shipping' },
    });
    expect(costLine).toMatchObject({
      amountMinor: 8000n,
      sourceType: 'return',
      sourceId: ctx.returnId,
    });

    const result = await inTx<{ status: string }>((tx) =>
      resolveReturn(tx, {
        returnId: ctx.returnId,
        resolution: 'refund',
        idempotencyKey: 'return-refund-1',
        staff: ctx.manager.staff,
      }),
    );
    expect(result.status).toBe('refunded');
    const order = await db.order.findUniqueOrThrow({ where: { id: ctx.orderId } });
    // 2 x 2,000 refunded of the whole total (the delivery charge stays).
    expect(order).toMatchObject({
      status: 'refunded',
      refundedMinor: 400000n,
      paymentStatus: 'partially_refunded',
    });
    expect(order.refundedMinor).toBeLessThanOrEqual(order.paidMinor);
    const refund = await db.refund.findFirstOrThrow({ where: { orderId: ctx.orderId } });
    expect(refund).toMatchObject({
      status: 'succeeded',
      method: 'manual_bkash',
      returnRequestId: ctx.returnId,
      amountMinor: 400000n,
    });

    const profit = await getOrderProfit(ctx.orderId);
    const m = (key: keyof NonNullable<typeof profit>['figures']) =>
      BigInt(profit!.figures[key].minor);
    expect(m('grossSales')).toBe(400000n);
    expect(m('refunds')).toBe(400000n);
    expect(m('netSales')).toBe(0n);
    // The goods came back: no cost of goods; the courier both ways is the loss.
    expect(m('cogs')).toBe(0n);
    expect(m('returnCosts')).toBe(8000n);
    expect(m('shippingCost')).toBe(9000n);
    expect(m('contributionMargin')).toBe(
      0n +
        BigInt(
          (await db.order.findUniqueOrThrow({ where: { id: ctx.orderId } })).shippingChargedMinor,
        ) -
        9000n -
        8000n,
    );
  });

  it('a damaged unit is written off with its own movement and its cost stays in the order', async () => {
    const ctx = await inspected({ quantity: 2, returned: 1, damaged: 1 });
    // 8 on hand after the sale; the damaged one came back and was written off: still 8.
    expect(await onHand(ctx.variant.variantId)).toBe(8);
    const movements = await db.stockMovement.findMany({
      where: { referenceType: 'return', referenceId: ctx.returnId },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements.map((m) => [m.type, m.quantity])).toEqual([
      ['return_restock', 1],
      ['write_off', -1],
    ]);
    expect(await findLedgerMismatches(ctx.variant.variantId)).toEqual([]);

    await inTx((tx) =>
      resolveReturn(tx, {
        returnId: ctx.returnId,
        resolution: 'refund',
        amount: '1800',
        idempotencyKey: 'return-refund-2',
        staff: ctx.manager.staff,
      }),
    );
    // Only one of two units came back, so the order stands: delivered again, partially refunded.
    const order = await db.order.findUniqueOrThrow({ where: { id: ctx.orderId } });
    expect(order).toMatchObject({
      status: 'delivered',
      refundedMinor: 180000n,
      paymentStatus: 'partially_refunded',
    });
    const profit = await getOrderProfit(ctx.orderId);
    // Cost of both units stays: one sold, one lost as damaged.
    expect(BigInt(profit!.figures.cogs.minor)).toBe(200000n);
    expect(BigInt(profit!.figures.netSales.minor)).toBe(400000n - 180000n);
  });

  it('a refund is idempotent and can never exceed what was paid', async () => {
    const ctx = await inspected({ quantity: 1, returned: 1 });
    const resolve = () =>
      inTx<{ status: string }>((tx) =>
        resolveReturn(tx, {
          returnId: ctx.returnId,
          resolution: 'refund',
          idempotencyKey: 'return-refund-3',
          staff: ctx.manager.staff,
        }),
      );
    await resolve();
    await resolve();
    expect(await db.refund.count({ where: { orderId: ctx.orderId, status: 'succeeded' } })).toBe(1);
    // Another refund on the same order beyond what is left is refused by the service ...
    expect(
      await errorOf(
        inTx((tx) =>
          processRefund(tx, {
            orderId: ctx.orderId,
            amount: '99999',
            method: 'manual_bkash',
            reason: 'goodwill',
            idempotencyKey: 'too-much-1',
            staff: ctx.manager.staff,
          }),
        ),
      ),
    ).toMatch(/^VALIDATION/);
    // ... and by the database even if the service were bypassed (INV-P4).
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: ctx.orderId } });
    await expect(
      db.refund.create({
        data: {
          orderId: ctx.orderId,
          paymentId: payment.id,
          amountMinor: payment.amountMinor,
          currency: 'BDT',
          reason: 'forced',
          status: 'requested',
        },
      }),
    ).rejects.toThrow(/exceed the captured amount/);
  });

  it('store credit lands in the ledger for an account and is refused for a guest order', async () => {
    const ctx = await inspected({ quantity: 1, returned: 1 });
    expect(
      await errorOf(
        inTx((tx) =>
          resolveReturn(tx, {
            returnId: ctx.returnId,
            resolution: 'store_credit',
            idempotencyKey: 'credit-guest-1',
            staff: ctx.manager.staff,
          }),
        ),
      ),
    ).toMatch(/^VALIDATION: Store credit needs a customer account/);
    const customer = await makeCustomer();
    await db.order.update({ where: { id: ctx.orderId }, data: { userId: customer.user.id } });
    await inTx((tx) =>
      resolveReturn(tx, {
        returnId: ctx.returnId,
        resolution: 'store_credit',
        idempotencyKey: 'credit-user-1',
        staff: ctx.manager.staff,
      }),
    );
    const entries = await db.storeCreditEntry.findMany({ where: { userId: customer.user.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ amountMinor: 200000n, reason: 'return', currency: 'BDT' });
    // The ledger is append-only.
    await expect(
      db.storeCreditEntry.update({ where: { id: entries[0]!.id }, data: { amountMinor: 1n } }),
    ).rejects.toThrow();
  });

  it('a return can be closed without a refund when nothing is due', async () => {
    const ctx = await inspected({ quantity: 1, returned: 1, damaged: 1 });
    await inTx((tx) =>
      closeReturn(tx, {
        returnId: ctx.returnId,
        note: 'Worn and stained',
        staff: ctx.manager.staff,
      }),
    );
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: ctx.returnId } })).status).toBe(
      'closed',
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: ctx.orderId } })).status).toBe(
      'delivered',
    );
    expect(await db.refund.count({ where: { orderId: ctx.orderId } })).toBe(0);
  });

  it('steps must happen in order', async () => {
    const delivered = await deliveredOrder({ quantity: 1 });
    const [item] = await itemsOf(delivered.orderId);
    const { returnId } = await inTx<{ returnId: string }>((tx) =>
      requestReturn(tx, {
        orderId: delivered.orderId,
        type: 'return',
        items: [{ orderItemId: item!.id, quantity: 1, reason: 'defective' }],
      }),
    );
    const staff = await manager();
    expect(
      await errorOf(
        inTx((tx) => receiveReturn(tx, { returnId, shippingCostMinor: 0n, staff: staff.staff })),
      ),
    ).toMatch(/^CONFLICT/);
    expect(
      await errorOf(
        inTx((tx) =>
          resolveReturn(tx, {
            returnId,
            resolution: 'refund',
            idempotencyKey: 'early-1',
            staff: staff.staff,
          }),
        ),
      ),
    ).toMatch(/^CONFLICT/);
  });
});

describe('exchange for another size (6.12)', () => {
  async function productWithSizes() {
    const { makeSellableVariant: make } = await import('./commerce-helpers');
    const small = await make({
      stock: 5,
      size: 's',
      priceMinor: 250000n,
      costMinor: 100000n,
      title: 'Linen shirt',
    });
    // A second size of the same product, same price.
    const large = await db.productVariant.create({
      data: {
        productId: small.productId,
        sku: `${small.sku}-L`,
        priceMinor: 250000n,
        avgCostMinor: 110000n,
        status: 'active',
      },
    });
    await db.$transaction((tx) =>
      receive(tx, {
        variantId: large.id,
        quantity: 3,
        unitCostMinor: 110000n,
        referenceType: 'test',
        referenceId: 'seed-large',
      }),
    );
    return { small, large };
  }

  it('swaps one size for another through stock: the old unit returns, the new one leaves, sales stay the same', async () => {
    const { small, large } = await productWithSizes();
    const delivered = await deliveredOrder({ variant: small, quantity: 1 });
    const [item] = await itemsOf(delivered.orderId);
    const { returnId } = await inTx<{ returnId: string }>((tx) =>
      requestReturn(tx, {
        orderId: delivered.orderId,
        type: 'exchange',
        items: [
          { orderItemId: item!.id, quantity: 1, reason: 'too_small', exchangeVariantId: large.id },
        ],
      }),
    );
    const staff = await manager();
    await inTx((tx) => approveReturn(tx, { returnId, staff: staff.staff }));
    await inTx((tx) => receiveReturn(tx, { returnId, shippingCostMinor: 0n, staff: staff.staff }));
    const returnItem = await db.returnItem.findFirstOrThrow({ where: { returnId } });
    await inTx((tx) =>
      inspectReturn(tx, {
        returnId,
        conditions: [{ returnItemId: returnItem.id, condition: 'resellable' }],
        staff: staff.staff,
      }),
    );
    // Refunding an exchange is refused: it is resolved as an exchange.
    expect(
      await errorOf(
        inTx((tx) =>
          resolveReturn(tx, {
            returnId,
            resolution: 'refund',
            idempotencyKey: 'ex-refund-1',
            staff: staff.staff,
          }),
        ),
      ),
    ).toMatch(/^VALIDATION/);
    const result = await inTx<{ status: string }>((tx) =>
      resolveReturn(tx, {
        returnId,
        resolution: 'exchange',
        idempotencyKey: 'ex-1',
        staff: staff.staff,
      }),
    );
    expect(result.status).toBe('exchanged');
    expect(await onHand(small.variantId)).toBe(5);
    expect(await onHand(large.id)).toBe(2);
    expect(await findLedgerMismatches()).toEqual([]);
    const order = await db.order.findUniqueOrThrow({
      where: { id: delivered.orderId },
      include: { items: true },
    });
    expect(order.status).toBe('exchanged');
    const replacement = order.items.find((line) => line.replacementOfItemId === item!.id);
    expect(replacement).toMatchObject({
      variantId: large.id,
      unitPriceMinor: 0n,
      unitCostMinor: 110000n,
      quantity: 1,
    });
    // No money moved, and the totals did not change.
    expect(await db.refund.count({ where: { orderId: delivered.orderId } })).toBe(0);
    expect(order.subtotalMinor).toBe(250000n);
    const profit = await getOrderProfit(delivered.orderId);
    // Net sales unchanged; cost of goods is the replacement that left (the first unit came back).
    expect(BigInt(profit!.figures.netSales.minor)).toBe(250000n);
    expect(BigInt(profit!.figures.cogs.minor)).toBe(110000n);
  });

  it('an exchange must be the same piece at the same price, in stock', async () => {
    const { small, large } = await productWithSizes();
    const other = await makeSellableVariant({
      stock: 4,
      priceMinor: 250000n,
      title: 'Different shirt',
    });
    const dearer = await db.productVariant.create({
      data: {
        productId: small.productId,
        sku: `${small.sku}-XL`,
        priceMinor: 300000n,
        avgCostMinor: 120000n,
        status: 'active',
      },
    });
    const delivered = await deliveredOrder({ variant: small, quantity: 1 });
    const [item] = await itemsOf(delivered.orderId);
    const ask = (exchangeVariantId: string | undefined) =>
      inTx((tx) =>
        requestReturn(tx, {
          orderId: delivered.orderId,
          type: 'exchange',
          items: [{ orderItemId: item!.id, quantity: 1, reason: 'too_small', exchangeVariantId }],
        }),
      );
    expect(await errorOf(ask(undefined))).toMatch(/^VALIDATION: Choose the size/);
    expect(await errorOf(ask(other.variantId))).toMatch(
      /^VALIDATION: An exchange must be another size/,
    );
    expect(await errorOf(ask(dearer.id))).toMatch(/^VALIDATION: An exchange must be another size/);
    expect(await errorOf(ask(small.variantId))).toMatch(/^VALIDATION: Choose a different size/);
    await db.inventoryLevel.updateMany({ where: { variantId: large.id }, data: { onHand: 0 } });
    expect(await errorOf(ask(large.id))).toMatch(/^OUT_OF_STOCK/);
  });
});

describe('refund approval above the threshold (maker-checker, INV-A6)', () => {
  it('needs a second person to approve a large refund, once, for exactly that order', async () => {
    const delivered = await deliveredOrder({ quantity: 3, priceMinor: 400000n, stock: 10 });
    const requester = await manager();
    const approver = await manager();
    const refund = (key: string) =>
      inTx((tx) =>
        processRefund(tx, {
          orderId: delivered.orderId,
          amount: '6000',
          method: 'manual_bkash',
          reason: 'goodwill',
          idempotencyKey: key,
          staff: requester.staff,
        }),
      );
    // 6,000 is above the default 5,000 threshold: refused until approved.
    expect(await errorOf(refund('big-1'))).toMatch(/^APPROVAL_REQUIRED/);
    const requested = await inTx<{ required: boolean; request?: { id: string } }>((tx) =>
      requestApproval(tx, requester.context, {
        kind: 'refund',
        subjectType: 'order',
        subjectId: delivered.orderId,
        amountMinor: 600000n,
        currency: 'BDT',
        reason: 'goodwill',
      }),
    );
    expect(requested.required).toBe(true);
    // The requester cannot approve their own request.
    expect(
      await errorOf(
        inTx((tx) =>
          decideApproval(tx, requester.context, {
            id: requested.request!.id,
            decision: 'approved',
          }),
        ),
      ),
    ).toMatch(/^FORBIDDEN/);
    await inTx((tx) =>
      decideApproval(tx, approver.context, { id: requested.request!.id, decision: 'approved' }),
    );
    await refund('big-2');
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: delivered.orderId } })).refundedMinor,
    ).toBe(600000n);
    // The approval was good for one refund only.
    expect(await errorOf(refund('big-3'))).toMatch(/^APPROVAL_REQUIRED/);
  });

  it('a small refund needs no second person, and COD cannot be refunded before delivery', async () => {
    const delivered = await deliveredOrder({ quantity: 1 });
    const staff = await manager();
    await inTx((tx) =>
      processRefund(tx, {
        orderId: delivered.orderId,
        amount: '500',
        method: 'manual_bkash',
        reason: 'late delivery',
        providerRef: 'TRX123',
        idempotencyKey: 'small-1',
        staff: staff.staff,
      }),
    );
    const order = await db.order.findUniqueOrThrow({ where: { id: delivered.orderId } });
    expect(order).toMatchObject({ refundedMinor: 50000n, paymentStatus: 'partially_refunded' });
    expect(
      (
        await db.auditLog.findFirst({
          where: { entityId: delivered.orderId, action: 'order.refund' },
        })
      )?.actorId,
    ).toBe(staff.staff.userId);

    const { placeTestOrder } = await import('./commerce-helpers');
    const variant = await makeSellableVariant({ stock: 2 });
    const unpaid = await placeTestOrder({ variant });
    expect(
      await errorOf(
        inTx((tx) =>
          processRefund(tx, {
            orderId: unpaid.orderId,
            amount: '100',
            method: 'manual_bkash',
            reason: 'x',
            idempotencyKey: 'unpaid-1',
            staff: staff.staff,
          }),
        ),
      ),
    ).toMatch(/^CONFLICT: Nothing has been paid/);
  });
});
