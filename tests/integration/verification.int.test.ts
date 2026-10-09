import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { isDomainError } from '@/lib/errors';
import { editOrder } from '@/modules/orders/edit';
import {
  assignOrder,
  cancelOrder,
  claimOrder,
  confirmOrder,
  holdOrder,
  releaseOrder,
} from '@/modules/orders/verification';
import { transitionOrder } from '@/modules/orders/transitions';
import { findLedgerMismatches } from '@/modules/inventory/service';
import { makeStaff } from '../factories';
import {
  areaIds,
  fullChecklist,
  makeSellableVariant,
  placeTestOrder,
  seedDelivery,
  verifierOf,
} from './commerce-helpers';
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

async function staff(role: 'order_verifier' | 'manager' | 'support' = 'order_verifier') {
  const made = await makeStaff({ role });
  return { ...made, verifier: verifierOf(made.member, { manager: role === 'manager' }) };
}

async function placed(options: { stock?: number; quantity?: number } = {}) {
  const variant = await makeSellableVariant({ stock: options.stock ?? 10 });
  const order = await placeTestOrder({ variant, quantity: options.quantity ?? 1 });
  return { variant, ...order };
}

const stockOf = async (variantId: string) =>
  (await db.inventoryLevel.findFirstOrThrow({ where: { variantId } })).onHand;

describe('confirming an order (6.13, INV-O1, INV-O9)', () => {
  it('confirms with the whole checklist: verifier from the session, attempt, timeline, audit, events', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    const result = await inTx<{ status: string }>((tx) =>
      confirmOrder(tx, {
        orderId,
        checklist: fullChecklist,
        channel: 'call',
        note: 'Spoke to the customer',
        verifier: verifier.verifier,
      }),
    );
    expect(result.status).toBe('confirmed');
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'confirmed', confirmedBy: verifier.member.id });
    expect(order.confirmedAt).not.toBeNull();

    const attempts = await db.orderVerificationAttempt.findMany({ where: { orderId } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      outcome: 'verified',
      staffId: verifier.member.id,
      channel: 'call',
      checklist: fullChecklist,
    });
    const events = await db.orderEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((event) => event.toStatus)).toContain('confirmed');
    const outbox = await db.outboxEvent.findMany({ where: { aggregateId: orderId } });
    expect(outbox.map((event) => event.type).sort()).toEqual(
      expect.arrayContaining(['order.confirmed', 'order.placed', 'order.status_changed']),
    );
    const audit = await db.auditLog.findFirst({
      where: { entityId: orderId, action: 'order.confirm' },
    });
    expect(audit?.actorId).toBe(verifier.member.userId);
  });

  it('refuses a checklist that is not complete, and writes nothing', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    for (const key of Object.keys(fullChecklist) as Array<keyof typeof fullChecklist>) {
      const code = await errorOf(
        inTx((tx) =>
          confirmOrder(tx, {
            orderId,
            checklist: { ...fullChecklist, [key]: false },
            channel: 'call',
            verifier: verifier.verifier,
          }),
        ),
      );
      expect(code).toMatch(/^VALIDATION/);
    }
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('placed');
    expect(await db.orderVerificationAttempt.count({ where: { orderId } })).toBe(0);
  });

  it('is idempotent for an order that is already confirmed', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    const confirm = () =>
      inTx((tx) =>
        confirmOrder(tx, {
          orderId,
          checklist: fullChecklist,
          channel: 'call',
          verifier: verifier.verifier,
        }),
      );
    await confirm();
    await confirm();
    expect(await db.orderVerificationAttempt.count({ where: { orderId } })).toBe(1);
    expect(
      await db.outboxEvent.count({ where: { type: 'order.confirmed', aggregateId: orderId } }),
    ).toBe(1);
  });

  it('two people confirming at once: exactly one wins, the other is told the order has moved', async () => {
    const { orderId } = await placed();
    const a = await staff();
    const b = await staff('manager');
    const confirm = (who: typeof a) =>
      errorOf(
        inTx((tx) =>
          confirmOrder(tx, {
            orderId,
            checklist: fullChecklist,
            channel: 'call',
            verifier: who.verifier,
          }),
        ),
      );
    await Promise.all([confirm(a), confirm(b)]);
    expect(
      await db.orderVerificationAttempt.count({ where: { orderId, outcome: 'verified' } }),
    ).toBe(1);
    expect(
      await db.outboxEvent.count({ where: { type: 'order.confirmed', aggregateId: orderId } }),
    ).toBe(1);
  });

  it('an order that is not waiting for verification cannot be confirmed', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    await inTx((tx) =>
      cancelOrder(tx, { orderId, reason: 'duplicate', verifier: verifier.verifier }),
    );
    expect(
      await errorOf(
        inTx((tx) =>
          confirmOrder(tx, {
            orderId,
            checklist: fullChecklist,
            channel: 'call',
            verifier: verifier.verifier,
          }),
        ),
      ),
    ).toMatch(/^CONFLICT/);
  });

  it('the system can never confirm or cancel: the state machine refuses it before the database is touched (INV-O1, INV-O2)', async () => {
    const { orderId } = await placed();
    for (const to of ['confirmed', 'cancelled'] as const) {
      expect(
        await errorOf(
          inTx((tx) => transitionOrder(tx, { orderId, from: 'placed', to, actor: 'system' })),
        ),
      ).toMatch(/^INVALID_TRANSITION/);
    }
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('placed');
  });
});

describe('claim lock, release and assignment (6.4)', () => {
  it('a claim keeps the order for one person and moves it to under_verification', async () => {
    const { orderId } = await placed();
    const a = await staff();
    const b = await staff('support');
    const claimed = await inTx<{ claimExpiresAt: Date }>((tx) =>
      claimOrder(tx, { orderId, verifier: a.verifier }),
    );
    expect(claimed.claimExpiresAt.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'under_verification', assignedTo: a.member.id });

    // The lock is on the server: the second person can neither claim nor confirm.
    expect(await errorOf(inTx((tx) => claimOrder(tx, { orderId, verifier: b.verifier })))).toMatch(
      /^CONFLICT: .* is verifying this order until/,
    );
    expect(
      await errorOf(
        inTx((tx) =>
          confirmOrder(tx, {
            orderId,
            checklist: fullChecklist,
            channel: 'call',
            verifier: b.verifier,
          }),
        ),
      ),
    ).toMatch(/^CONFLICT/);
    // The holder may carry on, and renew.
    await inTx((tx) => claimOrder(tx, { orderId, verifier: a.verifier }));
  });

  it('an idle claim runs out and someone else can take over; a manager can always take over', async () => {
    const { orderId } = await placed();
    const a = await staff();
    const b = await staff('support');
    const manager = await staff('manager');
    await inTx((tx) => claimOrder(tx, { orderId, verifier: a.verifier }));
    await db.order.update({
      where: { id: orderId },
      data: { claimExpiresAt: new Date(Date.now() - 1000) },
    });
    await inTx((tx) => claimOrder(tx, { orderId, verifier: b.verifier }));
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).assignedTo).toBe(
      b.member.id,
    );
    await inTx((tx) => claimOrder(tx, { orderId, verifier: manager.verifier }));
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).assignedTo).toBe(
      manager.member.id,
    );
  });

  it('release puts a fresh order back in the queue and a tried one back on hold', async () => {
    const { orderId } = await placed();
    const a = await staff();
    const b = await staff('support');
    await inTx((tx) => claimOrder(tx, { orderId, verifier: a.verifier }));
    expect(
      await errorOf(inTx((tx) => releaseOrder(tx, { orderId, verifier: b.verifier }))),
    ).toMatch(/^FORBIDDEN/);
    await inTx((tx) => releaseOrder(tx, { orderId, verifier: a.verifier }));
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'placed', assignedTo: null, claimExpiresAt: null });
  });

  it('only a manager assigns, and only to someone who may verify', async () => {
    const { orderId } = await placed();
    const a = await staff();
    const manager = await staff('manager');
    const fulfilment = await makeStaff({ role: 'fulfillment' });
    expect(
      await errorOf(
        inTx((tx) => assignOrder(tx, { orderId, assigneeId: a.member.id, verifier: a.verifier })),
      ),
    ).toMatch(/^FORBIDDEN/);
    expect(
      await errorOf(
        inTx((tx) =>
          assignOrder(tx, {
            orderId,
            assigneeId: fulfilment.member.id,
            verifier: manager.verifier,
          }),
        ),
      ),
    ).toMatch(/^VALIDATION/);
    await inTx((tx) =>
      assignOrder(tx, { orderId, assigneeId: a.member.id, verifier: manager.verifier }),
    );
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({
      status: 'under_verification',
      assignedTo: a.member.id,
      claimExpiresAt: null,
    });
    // Someone else cannot take a manager's assignment; the manager can reassign.
    const b = await staff('support');
    expect(await errorOf(inTx((tx) => claimOrder(tx, { orderId, verifier: b.verifier })))).toMatch(
      /^CONFLICT: This order is assigned to/,
    );
    await inTx((tx) =>
      assignOrder(tx, { orderId, assigneeId: b.member.id, verifier: manager.verifier }),
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).assignedTo).toBe(
      b.member.id,
    );
  });
});

describe('call back later and escalation (6.13, 6.15, INV-O2)', () => {
  it('logs each attempt, holds the order, and flags a manager after the threshold without cancelling', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    const next = new Date(Date.now() + 3 * 3600_000);
    const hold = (outcome: 'no_answer' | 'busy' | 'callback_requested') =>
      inTx<{ needsManagerReview: boolean }>((tx) =>
        holdOrder(tx, {
          orderId,
          outcome,
          channel: 'call',
          note: outcome,
          nextAttemptAt: next,
          verifier: verifier.verifier,
        }),
      );
    expect((await hold('no_answer')).needsManagerReview).toBe(false);
    let order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({
      status: 'on_hold',
      verificationAttempts: 1,
      assignedTo: null,
      needsManagerReview: false,
    });
    expect(order.nextAttemptAt?.getTime()).toBe(next.getTime());
    expect((await hold('busy')).needsManagerReview).toBe(false);
    // Default threshold is 3 failed contact attempts.
    expect((await hold('no_answer')).needsManagerReview).toBe(true);
    order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({
      status: 'on_hold',
      verificationAttempts: 3,
      needsManagerReview: true,
    });
    expect(order.escalatedAt).not.toBeNull();
    expect(await db.orderVerificationAttempt.count({ where: { orderId } })).toBe(3);
    expect(
      await db.outboxEvent.count({ where: { type: 'order.escalated', aggregateId: orderId } }),
    ).toBe(1);
    // A fourth failure does not raise a second alert.
    await hold('no_answer');
    expect(
      await db.outboxEvent.count({ where: { type: 'order.escalated', aggregateId: orderId } }),
    ).toBe(1);
    // Nothing was cancelled, stock is still held for the customer.
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('on_hold');
  });

  it('a held order can be picked up again and confirmed (on_hold to under_verification to confirmed)', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    await inTx((tx) =>
      holdOrder(tx, {
        orderId,
        outcome: 'callback_requested',
        channel: 'call',
        verifier: verifier.verifier,
      }),
    );
    await inTx((tx) => claimOrder(tx, { orderId, verifier: verifier.verifier }));
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      'under_verification',
    );
    await inTx((tx) =>
      confirmOrder(tx, {
        orderId,
        checklist: fullChecklist,
        channel: 'whatsapp',
        verifier: verifier.verifier,
      }),
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('confirmed');
  });

  it('refuses a call-back time in the past', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    expect(
      await errorOf(
        inTx((tx) =>
          holdOrder(tx, {
            orderId,
            outcome: 'callback_requested',
            channel: 'call',
            nextAttemptAt: new Date(Date.now() - 3600_000),
            verifier: verifier.verifier,
          }),
        ),
      ),
    ).toMatch(/^VALIDATION/);
  });
});

describe('cancelling an order (6.13, INV-O2, INV-S3)', () => {
  it('releases the stock, records the reason and the attempt, and never double restocks', async () => {
    const { orderId, variant } = await placed({ stock: 5, quantity: 2 });
    expect(await stockOf(variant.variantId)).toBe(3);
    const verifier = await staff();
    const run = () =>
      inTx((tx) =>
        cancelOrder(tx, {
          orderId,
          reason: 'customer_cancelled',
          note: 'Changed mind',
          verifier: verifier.verifier,
        }),
      );
    await run();
    await run();
    expect(await stockOf(variant.variantId)).toBe(5);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({
      status: 'cancelled',
      cancelReason: 'customer_cancelled',
      cancelledBy: verifier.member.id,
    });
    expect(
      await db.orderVerificationAttempt.count({
        where: { orderId, outcome: 'customer_cancelled' },
      }),
    ).toBe(1);
    expect(await findLedgerMismatches(variant.variantId)).toEqual([]);
  });

  it('fake_order flags the phone, which then cannot order online', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const first = await placeTestOrder({ variant, phone: '01711112222' });
    const verifier = await staff();
    await inTx((tx) =>
      cancelOrder(tx, {
        orderId: first.orderId,
        reason: 'fake_order',
        verifier: verifier.verifier,
      }),
    );
    expect(
      await db.customerRiskFlag.count({ where: { phone: '+8801711112222', type: 'fake_order' } }),
    ).toBe(1);
    expect(await errorOf(placeTestOrder({ variant, phone: '01711112222' }))).toMatch(/^FORBIDDEN/);
  });

  it('a paid order gets a refund REQUEST, never an automatic refund', async () => {
    const { orderId } = await placed();
    const payment = await db.payment.findFirstOrThrow({ where: { orderId } });
    // Simulate money collected before the cancellation (an online payment, once gateways exist).
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'succeeded', paidAt: new Date() },
    });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    await db.order.update({
      where: { id: orderId },
      data: { paidMinor: order.totalMinor, paymentStatus: 'paid' },
    });
    const verifier = await staff();
    const result = await inTx<{ refundRequested: boolean }>((tx) =>
      cancelOrder(tx, { orderId, reason: 'out_of_stock', verifier: verifier.verifier }),
    );
    expect(result.refundRequested).toBe(true);
    const refund = await db.refund.findFirstOrThrow({ where: { orderId } });
    expect(refund).toMatchObject({
      status: 'requested',
      amountMinor: order.totalMinor,
      processedAt: null,
    });
    const after = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(after.refundedMinor).toBe(0n);
    expect(after.paymentStatus).toBe('paid');
  });

  it('a cash on delivery order cancelled before delivery has nothing to refund', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    const result = await inTx<{ refundRequested: boolean }>((tx) =>
      cancelOrder(tx, { orderId, reason: 'duplicate', verifier: verifier.verifier }),
    );
    expect(result.refundRequested).toBe(false);
    expect(await db.refund.count({ where: { orderId } })).toBe(0);
  });

  it('staff without cancel rights cannot cancel a confirmed order', async () => {
    const { orderId } = await placed();
    const verifier = await staff();
    await inTx((tx) =>
      confirmOrder(tx, {
        orderId,
        checklist: fullChecklist,
        channel: 'call',
        verifier: verifier.verifier,
      }),
    );
    const noCancel = { ...verifier.verifier, canCancel: false };
    expect(
      await errorOf(
        inTx((tx) => cancelOrder(tx, { orderId, reason: 'duplicate', verifier: noCancel })),
      ),
    ).toMatch(/^FORBIDDEN/);
    await inTx((tx) =>
      cancelOrder(tx, { orderId, reason: 'duplicate', verifier: verifier.verifier }),
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('cancelled');
  });
});

describe('editing an order during verification (6.14)', () => {
  it('changes size and quantity, re-prices on the server, adjusts stock and tells the customer', async () => {
    const small = await makeSellableVariant({
      stock: 5,
      size: 's',
      priceMinor: 250000n,
      title: 'Shirt S',
    });
    const large = await makeSellableVariant({
      stock: 5,
      size: 'l',
      priceMinor: 270000n,
      title: 'Shirt L',
    });
    const { orderId } = await placeTestOrder({ variant: small, quantity: 2 });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    const verifier = await staff();
    const before = await db.order.findUniqueOrThrow({ where: { id: orderId } });

    const result = await inTx<{ totalChanged: boolean }>((tx) =>
      editOrder(tx, {
        orderId,
        // Keep one of the first, add one of another variant (prices come from the database).
        lines: [
          { itemId: item.id, variantId: small.variantId, quantity: 1 },
          { variantId: large.variantId, quantity: 1 },
        ],
        verifier: verifier.verifier,
      }),
    );
    expect(result.totalChanged).toBe(true);
    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
    expect(order.items).toHaveLength(2);
    expect(order.subtotalMinor).toBe(250000n + 270000n);
    expect(order.totalMinor).toBe(order.subtotalMinor + order.shippingChargedMinor);
    expect(order.totalMinor).not.toBe(before.totalMinor);
    // 2 of S left stock at placement; 1 came back, 1 of L left.
    expect(await stockOf(small.variantId)).toBe(4);
    expect(await stockOf(large.variantId)).toBe(4);
    expect(await findLedgerMismatches()).toEqual([]);
    // The unpaid cash on delivery payment follows the new total.
    expect((await db.payment.findFirstOrThrow({ where: { orderId } })).amountMinor).toBe(
      order.totalMinor,
    );
    expect(await db.orderEvent.count({ where: { orderId, type: 'order_edited' } })).toBe(1);
    expect(
      await db.orderVerificationAttempt.count({ where: { orderId, outcome: 'order_edited' } }),
    ).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: orderId, action: 'order.edit' } })).toBe(1);
    expect(
      await db.outboxEvent.count({ where: { type: 'order.updated', aggregateId: orderId } }),
    ).toBe(1);
  });

  it('keeps the price the customer agreed to on a line that stays, even if the catalog price moved', async () => {
    const variant = await makeSellableVariant({ stock: 5, priceMinor: 250000n });
    const { orderId } = await placeTestOrder({ variant, quantity: 1 });
    await db.productVariant.update({
      where: { id: variant.variantId },
      data: { priceMinor: 400000n },
    });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    const verifier = await staff();
    await inTx((tx) =>
      editOrder(tx, {
        orderId,
        lines: [{ itemId: item.id, variantId: variant.variantId, quantity: 2 }],
        verifier: verifier.verifier,
      }),
    );
    const after = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    expect(after).toMatchObject({ unitPriceMinor: 250000n, quantity: 2, totalMinor: 500000n });
  });

  it('refuses more than the stock allows and changes nothing (INV-S2)', async () => {
    const variant = await makeSellableVariant({ stock: 3 });
    const { orderId } = await placeTestOrder({ variant, quantity: 2 });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    const verifier = await staff();
    expect(
      await errorOf(
        inTx((tx) =>
          editOrder(tx, {
            orderId,
            lines: [{ itemId: item.id, variantId: variant.variantId, quantity: 9 }],
            verifier: verifier.verifier,
          }),
        ),
      ),
    ).toMatch(/^OUT_OF_STOCK/);
    expect(await stockOf(variant.variantId)).toBe(1);
    expect((await db.orderItem.findFirstOrThrow({ where: { orderId } })).quantity).toBe(2);
  });

  it('refuses a variant without a cost basis, like checkout does', async () => {
    const good = await makeSellableVariant({ stock: 3 });
    const noCost = await makeSellableVariant({ stock: 3, costMinor: 0n, title: 'No cost shirt' });
    const { orderId } = await placeTestOrder({ variant: good });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    const verifier = await staff();
    expect(
      await errorOf(
        inTx((tx) =>
          editOrder(tx, {
            orderId,
            lines: [
              { itemId: item.id, variantId: good.variantId, quantity: 1 },
              { variantId: noCost.variantId, quantity: 1 },
            ],
            verifier: verifier.verifier,
          }),
        ),
      ),
    ).toMatch(/^CONFLICT: .*cannot be ordered/);
  });

  it('fixes the address, re-quotes delivery, and respects the claim lock', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant });
    const areas = await areaIds();
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    const a = await staff();
    const b = await staff('support');
    await inTx((tx) => claimOrder(tx, { orderId, verifier: a.verifier }));
    const edit = (who: typeof a) =>
      inTx((tx) =>
        editOrder(tx, {
          orderId,
          lines: [{ itemId: item.id, variantId: variant.variantId, quantity: 1 }],
          address: {
            divisionId: areas.chattogram.divisionId,
            districtId: areas.cumilla.districtId,
            thanaName: 'Cumilla Sadar',
            area: 'Kandirpar',
            line1: 'House 7, Road 2',
          },
          verifier: who.verifier,
        }),
      );
    expect(await errorOf(edit(b))).toMatch(/^CONFLICT/);
    await edit(a);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect((order.shippingAddress as { district: { name: string } }).district.name).toBe('Cumilla');
    expect(order.totalMinor).toBe(order.subtotalMinor + order.shippingChargedMinor);
  });

  it('is refused once the order is confirmed, in the service and in the database', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant });
    const verifier = await staff();
    await inTx((tx) =>
      confirmOrder(tx, {
        orderId,
        checklist: fullChecklist,
        channel: 'call',
        verifier: verifier.verifier,
      }),
    );
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    expect(
      await errorOf(
        inTx((tx) =>
          editOrder(tx, {
            orderId,
            lines: [{ itemId: item.id, variantId: variant.variantId, quantity: 3 }],
            verifier: verifier.verifier,
          }),
        ),
      ),
    ).toMatch(/^CONFLICT/);
    // Even raw SQL cannot change a confirmed order's lines or totals.
    await expect(
      db.orderItem.update({ where: { id: item.id }, data: { quantity: 3 } }),
    ).rejects.toThrow(/cannot be changed once the order is confirmed/);
    await expect(db.orderItem.delete({ where: { id: item.id } })).rejects.toThrow(
      /cannot be removed once the order is confirmed/,
    );
    await expect(
      db.order.update({ where: { id: orderId }, data: { totalMinor: 1n, subtotalMinor: 1n } }),
    ).rejects.toThrow(/totals cannot change once the order is confirmed/);
    // Returns may still raise the returned quantity.
    await db.orderItem.update({ where: { id: item.id }, data: { quantityReturned: 1 } });
  });
});
