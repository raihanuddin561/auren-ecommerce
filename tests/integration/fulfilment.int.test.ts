import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { isDomainError } from '@/lib/errors';
import { getOrderProfit } from '@/modules/finance/service';
import { findLedgerMismatches } from '@/modules/inventory/service';
import {
  applyParcelUpdate,
  completeOrdersPastReturnWindow,
  pollParcels,
  receiveReturnToOrigin,
  shipOrder,
  startProcessing,
  updateParcelDetails,
} from '@/modules/orders/fulfilment';
import { cancelOrder, confirmOrder } from '@/modules/orders/verification';
import { createFakeTransport } from '@/modules/shipping/couriers/fake-transport';
import { buildCouriers, setCouriersForTests } from '@/modules/shipping/couriers/registry';
import { savePackagingProfile } from '@/modules/shipping/shipments';
import { makeStaff } from '../factories';
import {
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
afterEach(() => setCouriersForTests(null));
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

async function team() {
  const verifier = await makeStaff({ role: 'order_verifier' });
  const fulfiller = await makeStaff({ role: 'fulfillment' });
  return {
    verifier: verifierOf(verifier.member),
    fulfiller: {
      staffId: fulfiller.member.id,
      userId: fulfiller.member.userId,
      ip: null,
      userAgent: null,
    },
  };
}

/** A confirmed order of `quantity` units, priced 2,500 with cost 1,000 each. */
async function confirmed(quantity = 2, stock = 10) {
  const variant = await makeSellableVariant({ stock, priceMinor: 250000n, costMinor: 100000n });
  const { orderId } = await placeTestOrder({ variant, quantity });
  const people = await team();
  await inTx((tx) =>
    confirmOrder(tx, {
      orderId,
      checklist: fullChecklist,
      channel: 'call',
      verifier: people.verifier,
    }),
  );
  return { variant, orderId, ...people };
}

const manualBooking = (
  orderId: string,
  fulfiller: Awaited<ReturnType<typeof team>>['fulfiller'],
) => ({
  orderId,
  courier: 'manual' as const,
  courierName: 'Sundarban',
  trackingNumber: 'SB-1001',
  costMinor: 9000n,
  fulfiller,
});

describe('shipping and delivery (6.7, 6.9, 5.4)', () => {
  it('a confirmed order is booked with a manual courier, delivered, collected and shows its profit', async () => {
    const { orderId, fulfiller } = await confirmed(2);
    await savePackagingProfile(
      { name: 'Signature box', cost: '35', isDefault: true, active: true },
      { userId: fulfiller.userId },
    );

    const shipped = await shipOrder(manualBooking(orderId, fulfiller));
    expect(shipped.trackingNumber).toBe('SB-1001');
    let order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'shipped', fulfillmentStatus: 'fulfilled' });
    expect(order.shippedAt).not.toBeNull();
    const shipment = await db.shipment.findFirstOrThrow({ where: { orderId } });
    expect(shipment).toMatchObject({
      courier: 'manual',
      courierName: 'Sundarban',
      trackingNumber: 'SB-1001',
      status: 'booked',
      costMinor: 9000n,
    });
    // COD to collect is the whole total, the courier cost and the packaging are cost lines with sources.
    expect(shipment.codAmountMinor).toBe(order.totalMinor);
    const lines = await db.orderCostLine.findMany({ where: { orderId }, orderBy: { type: 'asc' } });
    expect(lines.map((line) => [line.type, line.amountMinor])).toEqual([
      ['shipping', 9000n],
      ['packaging', 3500n],
    ]);
    expect(lines.find((l) => l.type === 'shipping')).toMatchObject({
      sourceType: 'shipment',
      sourceId: shipment.id,
    });

    // The money is not real until delivery.
    expect(order.paidMinor).toBe(0n);
    const delivered = await inTx<{ status: string }>((tx) =>
      applyParcelUpdate(tx, {
        orderId,
        shipmentId: shipment.id,
        status: 'delivered',
        codFeeMinor: 5200n,
        actor: { kind: 'staff', fulfiller },
      }),
    );
    expect(delivered.status).toBe('delivered');
    order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'delivered', paymentStatus: 'paid' });
    expect(order.paidMinor).toBe(order.totalMinor);
    expect(order.deliveredAt).not.toBeNull();
    const payment = await db.payment.findFirstOrThrow({ where: { orderId } });
    expect(payment.status).toBe('succeeded');
    expect(payment.paidAt).not.toBeNull();
    expect((await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status).toBe(
      'delivered',
    );

    // Profit: 2 x 2,500 sales, 2 x 1,000 goods, delivery charged less courier, COD fee, packaging.
    const profit = await getOrderProfit(orderId);
    expect(profit?.recognised).toBe(true);
    const minor = (key: keyof NonNullable<typeof profit>['figures']) =>
      BigInt(profit!.figures[key].minor);
    expect(minor('grossSales')).toBe(500000n);
    expect(minor('cogs')).toBe(200000n);
    expect(minor('shippingCost')).toBe(9000n);
    expect(minor('codFees')).toBe(5200n);
    expect(minor('packaging')).toBe(3500n);
    expect(minor('contributionMargin')).toBe(
      300000n + order.shippingChargedMinor - 9000n - 5200n - 3500n,
    );
    // Every step is on the timeline.
    const types = (
      await db.orderEvent.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } })
    ).map((event) => event.toStatus ?? event.type);
    expect(types).toEqual(
      expect.arrayContaining(['placed', 'confirmed', 'processing', 'shipped', 'delivered']),
    );
  });

  it('refuses to book a parcel for an order nobody has confirmed (INV-O1)', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant });
    const { fulfiller } = await team();
    expect(await errorOf(shipOrder(manualBooking(orderId, fulfiller)))).toMatch(/^CONFLICT/);
    expect(await db.shipment.count()).toBe(0);
    expect(await errorOf(inTx((tx) => startProcessing(tx, { orderId, fulfiller })))).toMatch(
      /^INVALID_TRANSITION/,
    );
  });

  it('one live parcel per order; a failed delivery allows another booking', async () => {
    const { orderId, fulfiller } = await confirmed(1);
    await shipOrder(manualBooking(orderId, fulfiller));
    expect(await errorOf(shipOrder(manualBooking(orderId, fulfiller)))).toMatch(/^CONFLICT/);
    const first = await db.shipment.findFirstOrThrow({ where: { orderId } });
    await inTx((tx) =>
      applyParcelUpdate(tx, {
        orderId,
        shipmentId: first.id,
        status: 'failed',
        description: 'Customer not at home',
        actor: { kind: 'staff', fulfiller },
      }),
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      'delivery_failed',
    );
    await shipOrder({ ...manualBooking(orderId, fulfiller), trackingNumber: 'SB-1002' });
    expect(await db.shipment.count({ where: { orderId } })).toBe(2);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('shipped');
    // The packaging was counted once; the second courier charge is its own line.
    expect(await db.orderCostLine.count({ where: { orderId, type: 'shipping' } })).toBe(2);
  });

  it('a manual courier needs a name and a tracking number', async () => {
    const { orderId, fulfiller } = await confirmed(1);
    expect(
      await errorOf(
        shipOrder({ orderId, courier: 'manual', courierName: '', trackingNumber: '', fulfiller }),
      ),
    ).toMatch(/^VALIDATION/);
    expect(await db.shipment.count()).toBe(0);
  });

  it('an order with a parcel on its way cannot be cancelled', async () => {
    const { orderId, fulfiller, verifier } = await confirmed(1);
    await shipOrder(manualBooking(orderId, fulfiller));
    expect(
      await errorOf(inTx((tx) => cancelOrder(tx, { orderId, reason: 'duplicate', verifier }))),
    ).toMatch(/^CONFLICT/);
  });

  it('correcting the courier charge adds a correction line instead of rewriting history', async () => {
    const { orderId, fulfiller } = await confirmed(1);
    await shipOrder(manualBooking(orderId, fulfiller));
    const shipment = await db.shipment.findFirstOrThrow({ where: { orderId } });
    await inTx((tx) =>
      updateParcelDetails(tx, { orderId, shipmentId: shipment.id, costMinor: 12000n, fulfiller }),
    );
    await inTx((tx) =>
      updateParcelDetails(tx, { orderId, shipmentId: shipment.id, costMinor: 12000n, fulfiller }),
    );
    const lines = await db.orderCostLine.findMany({ where: { orderId, type: 'shipping' } });
    expect(lines.map((line) => line.amountMinor).sort()).toEqual([3000n, 9000n]);
    expect(lines.reduce((sum, line) => sum + line.amountMinor, 0n)).toBe(12000n);
    // The ledger cannot be edited by the application.
    await expect(
      db.orderCostLine.update({ where: { id: lines[0]!.id }, data: { amountMinor: 1n } }),
    ).rejects.toThrow();
    await expect(db.orderCostLine.delete({ where: { id: lines[0]!.id } })).rejects.toThrow();
  });
});

describe('API couriers through a fake transport (6.7, 6.8: not verified against live accounts)', () => {
  it('books with the courier, stores its consignment and cost, and polling applies delivery once', async () => {
    const { transport, requests } = createFakeTransport({
      'POST /create_order': {
        status: 200,
        json: { status: 200, consignment: { consignment_id: 5551, tracking_code: 'SF-5551' } },
      },
      'GET /status_by_cid/5551': { status: 200, json: { delivery_status: 'delivered' } },
    });
    setCouriersForTests(
      buildCouriers(
        {
          PATHAO_BASE_URL: 'https://p.test',
          STEADFAST_BASE_URL: 'https://s.test/api/v1',
          STEADFAST_API_KEY: 'k',
          STEADFAST_SECRET_KEY: 's',
        } as Parameters<typeof buildCouriers>[0],
        transport,
      ),
    );
    const { orderId, fulfiller } = await confirmed(1);
    await shipOrder({ orderId, courier: 'steadfast', costMinor: 8000n, fulfiller });
    const shipment = await db.shipment.findFirstOrThrow({ where: { orderId } });
    expect(shipment).toMatchObject({
      courier: 'steadfast',
      consignmentId: '5551',
      trackingNumber: 'SF-5551',
      costMinor: 8000n,
    });
    expect(requests[0]?.body).toMatchObject({ invoice: expect.stringMatching(/^AUR-/) });

    expect(await pollParcels()).toEqual({ checked: 1, applied: 1 });
    // A second poll finds the same update and changes nothing.
    expect(await pollParcels()).toEqual({ checked: 0, applied: 0 });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('delivered');
    expect(order.paymentStatus).toBe('paid');
    expect(
      await db.shipmentEvent.count({ where: { shipmentId: shipment.id, status: 'delivered' } }),
    ).toBe(1);
  });

  it('a courier that refuses leaves nothing behind and the order stays confirmed', async () => {
    const { transport } = createFakeTransport({
      'POST /create_order': { status: 422, json: { errors: {} } },
    });
    setCouriersForTests(
      buildCouriers(
        {
          PATHAO_BASE_URL: 'https://p.test',
          STEADFAST_BASE_URL: 'https://s.test/api/v1',
          STEADFAST_API_KEY: 'k',
          STEADFAST_SECRET_KEY: 's',
        } as Parameters<typeof buildCouriers>[0],
        transport,
      ),
    );
    const { orderId, fulfiller } = await confirmed(1);
    expect(await errorOf(shipOrder({ orderId, courier: 'steadfast', fulfiller }))).toMatch(
      /^CONFLICT: Steadfast did not accept/,
    );
    expect(await db.shipment.count()).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('confirmed');
    // A courier without keys is not even offered.
    expect(await errorOf(shipOrder({ orderId, courier: 'pathao', fulfiller }))).toMatch(
      /^VALIDATION|^CONFLICT/,
    );
  });
});

describe('return to origin (6.11)', () => {
  async function undelivered(quantity = 2) {
    const ctx = await confirmed(quantity, 6);
    await shipOrder(manualBooking(ctx.orderId, ctx.fulfiller));
    const shipment = await db.shipment.findFirstOrThrow({ where: { orderId: ctx.orderId } });
    await inTx((tx) =>
      applyParcelUpdate(tx, {
        orderId: ctx.orderId,
        shipmentId: shipment.id,
        status: 'failed',
        actor: { kind: 'staff', fulfiller: ctx.fulfiller },
      }),
    );
    return ctx;
  }

  it('restocks resellable goods, records the loss, flags the phone, and shows no sale', async () => {
    const { orderId, variant, fulfiller } = await undelivered(2);
    expect(
      (await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.variantId } }))
        .onHand,
    ).toBe(4);
    await inTx((tx) =>
      receiveReturnToOrigin(tx, { orderId, condition: 'resellable', lossMinor: 6000n, fulfiller }),
    );
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order).toMatchObject({ status: 'returned_to_origin', fulfillmentStatus: 'returned' });
    expect(order.paidMinor).toBe(0n);
    expect(
      (await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.variantId } }))
        .onHand,
    ).toBe(6);
    expect(await findLedgerMismatches(variant.variantId)).toEqual([]);
    expect(
      await db.orderCostLine.findFirstOrThrow({ where: { orderId, type: 'rto_loss' } }),
    ).toMatchObject({
      amountMinor: 6000n,
      sourceType: 'rto',
    });
    const flags = await db.customerRiskFlag.findMany({ where: { phone: order.phone } });
    expect(flags.map((flag) => flag.type)).toEqual(['manual']);
    // No sale happened: the loss is the courier cost, the return fee and the packaging; no goods are lost.
    const profit = await getOrderProfit(orderId);
    expect(BigInt(profit!.figures.grossSales.minor)).toBe(0n);
    expect(BigInt(profit!.figures.cogs.minor)).toBe(0n);
    expect(BigInt(profit!.figures.contributionMargin.minor)).toBe(-(9000n + 6000n));
    expect((await db.shipment.findFirstOrThrow({ where: { orderId } })).status).toBe('returned');
  });

  it('damaged goods are not restocked and stay as a loss at cost', async () => {
    const { orderId, variant, fulfiller } = await undelivered(2);
    await inTx((tx) =>
      receiveReturnToOrigin(tx, { orderId, condition: 'damaged', lossMinor: 0n, fulfiller }),
    );
    expect(
      (await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.variantId } }))
        .onHand,
    ).toBe(4);
    const profit = await getOrderProfit(orderId);
    expect(BigInt(profit!.figures.cogs.minor)).toBe(200000n);
    expect(BigInt(profit!.figures.contributionMargin.minor)).toBe(-(200000n + 9000n));
  });

  it('a second return to origin from the same phone makes it a repeat that cannot order online', async () => {
    const variant = await makeSellableVariant({ stock: 10 });
    const phone = '01755550000';
    const people = await team();
    for (const tracking of ['SB-1', 'SB-2']) {
      const { orderId } = await placeTestOrder({ variant, phone });
      await inTx((tx) =>
        confirmOrder(tx, {
          orderId,
          checklist: fullChecklist,
          channel: 'call',
          verifier: people.verifier,
        }),
      );
      await shipOrder({ ...manualBooking(orderId, people.fulfiller), trackingNumber: tracking });
      const shipment = await db.shipment.findFirstOrThrow({ where: { orderId } });
      await inTx((tx) =>
        applyParcelUpdate(tx, {
          orderId,
          shipmentId: shipment.id,
          status: 'failed',
          actor: { kind: 'staff', fulfiller: people.fulfiller },
        }),
      );
      await inTx((tx) =>
        receiveReturnToOrigin(tx, {
          orderId,
          condition: 'resellable',
          lossMinor: 0n,
          fulfiller: people.fulfiller,
        }),
      );
    }
    const flags = await db.customerRiskFlag.findMany({
      where: { phone: '+8801755550000' },
      orderBy: { createdAt: 'asc' },
    });
    expect(flags.map((flag) => flag.type)).toEqual(['manual', 'repeat_rto']);
    expect(await errorOf(placeTestOrder({ variant, phone }))).toMatch(/^FORBIDDEN/);
  });

  it('only a parcel that could not be delivered can come back to origin', async () => {
    const { orderId, fulfiller } = await confirmed(1);
    expect(
      await errorOf(
        inTx((tx) =>
          receiveReturnToOrigin(tx, { orderId, condition: 'resellable', lossMinor: 0n, fulfiller }),
        ),
      ),
    ).toMatch(/^CONFLICT/);
  });
});

describe('completion after the return window (system step)', () => {
  it('completes a delivered order after the window and never an order that is not delivered', async () => {
    const { orderId, fulfiller } = await confirmed(1);
    await shipOrder(manualBooking(orderId, fulfiller));
    const shipment = await db.shipment.findFirstOrThrow({ where: { orderId } });
    await inTx((tx) =>
      applyParcelUpdate(tx, {
        orderId,
        shipmentId: shipment.id,
        status: 'delivered',
        actor: { kind: 'staff', fulfiller },
      }),
    );
    expect(await completeOrdersPastReturnWindow()).toEqual({ completed: 0 });
    const inEightDays = new Date(Date.now() + 8 * 24 * 3600 * 1000);
    expect(await completeOrdersPastReturnWindow(inEightDays)).toEqual({ completed: 1 });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('completed');
    expect(order.completedAt).not.toBeNull();
    // Running it again changes nothing.
    expect(await completeOrdersPastReturnWindow(inEightDays)).toEqual({ completed: 0 });
  });

  it('never cancels or confirms anything, however long an order waits (INV-O1, INV-O2)', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant });
    await db.order.update({
      where: { id: orderId },
      data: { placedAt: new Date(Date.now() - 90 * 24 * 3600 * 1000) },
    });
    const later = new Date(Date.now() + 90 * 24 * 3600 * 1000);
    await completeOrdersPastReturnWindow(later);
    const { escalateOverdueOrders } = await import('@/modules/orders/escalation');
    await escalateOverdueOrders(later);
    const { releaseExpired } = await import('@/modules/inventory/service');
    await releaseExpired();
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    // Still waiting for a person, flagged overdue, stock still held.
    expect(order.status).toBe('placed');
    expect(order.escalatedAt).not.toBeNull();
    expect(order.cancelledAt).toBeNull();
    expect(order.confirmedAt).toBeNull();
    expect(
      (await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.variantId } }))
        .onHand,
    ).toBe(4);
    // The manager alert is raised once.
    await escalateOverdueOrders(later);
    expect(
      await db.outboxEvent.count({ where: { type: 'order.escalated', aggregateId: orderId } }),
    ).toBe(1);
  });
});

describe('order cost lines (11.5)', () => {
  it('a gateway fee is recorded once per payment, and a manual cost line is audited', async () => {
    const { recordGatewayFee, recordCostLine, addManualCostLine } =
      await import('@/modules/finance/service');
    const { orderId, fulfiller } = await confirmed(1);
    const payment = await db.payment.findFirstOrThrow({ where: { orderId } });
    const fee = () =>
      inTx<boolean>((tx) =>
        recordGatewayFee(tx, { orderId, paymentId: payment.id, feeMinor: 7500n, currency: 'BDT' }),
      );
    expect(await fee()).toBe(true);
    expect(await fee()).toBe(false);
    expect(await db.orderCostLine.count({ where: { orderId, type: 'gateway_fee' } })).toBe(1);
    // A zero cost is never written.
    expect(
      await inTx<boolean>((tx) =>
        recordCostLine(tx, { orderId, type: 'other', amountMinor: 0n, currency: 'BDT' }),
      ),
    ).toBe(false);

    await addManualCostLine({
      orderId,
      amountMinor: 2000n,
      note: 'Gift wrap',
      actorUserId: (await db.staffMember.findUniqueOrThrow({ where: { id: fulfiller.staffId } }))
        .userId,
      actorStaffId: fulfiller.staffId,
    });
    const manual = await db.orderCostLine.findFirstOrThrow({ where: { orderId, type: 'other' } });
    expect(manual).toMatchObject({
      amountMinor: 2000n,
      note: 'Gift wrap',
      actorId: fulfiller.staffId,
    });
    expect(
      await db.auditLog.count({ where: { entityId: orderId, action: 'order.cost_add' } }),
    ).toBe(1);
    const profit = await getOrderProfit(orderId);
    expect(BigInt(profit!.figures.gatewayFees.minor)).toBe(7500n);
    expect(BigInt(profit!.figures.otherCosts.minor)).toBe(2000n);
  });
});
