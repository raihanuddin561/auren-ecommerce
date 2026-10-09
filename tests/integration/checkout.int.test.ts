import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { clearLoggedEmails, getLoggedEmails } from '@/lib/email';
import { isDomainError } from '@/lib/errors';
import { clearLoggedSms, getLoggedSms } from '@/integrations/sms';
import { addLine, type CartIdentity } from '@/modules/cart/service';
import {
  requestOtp,
  submit,
  summarize,
  verifyOtp,
  type SubmitResult,
} from '@/modules/checkout/service';
import { placeOrderSchema, type PlaceOrderInput } from '@/modules/checkout/schemas';
import { handleOrderPlaced } from '@/modules/orders/queries';
import {
  lookupMinimal,
  orderIdForToken,
  trackingTokenFor,
  verifyTokenFactor,
  viewForToken,
} from '@/modules/orders/service';
import { saveCheckoutSettings } from '@/modules/settings/service';
import { releaseExpired, findLedgerMismatches, setCostBasis } from '@/modules/inventory/service';
import { purgeExpired } from '@/modules/cart/service';
import { makeStaff } from '../factories';
import { areaIds, makeSellableVariant, seedDelivery, type MadeVariant } from './commerce-helpers';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  await seedDelivery();
  clearLoggedEmails();
  clearLoggedSms();
});
afterAll(closeDatabase);

let phoneCounter = Math.floor(Math.random() * 8_000_000);
const nextPhone = () => `0171${String(++phoneCounter).padStart(7, '0')}`;

type Areas = Awaited<ReturnType<typeof areaIds>>;

function input(
  areas: Areas,
  overrides: Partial<PlaceOrderInput> = {},
  where: 'dhaka' | 'cumilla' = 'dhaka',
): PlaceOrderInput {
  const area = areas[where];
  // Cumilla is used without a listed thana, so the customer types it (the free-text fallback).
  const thanaName = area.thanaId ? undefined : 'Cumilla Sadar';
  return {
    idempotencyKey: `key-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    contact: { name: 'Ayaan Rahman', phone: nextPhone(), email: 'ayaan@example.com' },
    address: {
      divisionId: area.divisionId,
      districtId: area.districtId,
      thanaId: area.thanaId,
      ...(thanaName ? { thanaName } : {}),
      area: 'Section 10',
      line1: `House ${Math.floor(Math.random() * 90000)}, Road 4`,
    },
    paymentMethod: 'cod',
    ...overrides,
  };
}

async function bag(variant: MadeVariant, quantity = 1): Promise<CartIdentity> {
  const added = await addLine(
    { userId: null, token: null },
    { variantId: variant.variantId, quantity },
  );
  return { userId: null, token: added.newToken };
}

async function errorCode(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    return isDomainError(error)
      ? `${error.code}: ${error.message}`
      : `unexpected: ${String(error)}`;
  }
  return 'no error';
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('placing an order (4.6)', () => {
  it('creates a placed order with snapshots, stock, timeline, payment and outbox in one go', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({
      stock: 5,
      priceMinor: 250000n,
      costMinor: 90000n,
      title: 'Oxford shirt',
    });
    const identity = await bag(variant, 2);
    const result = await submit(identity, input(areas), { ip: '203.0.113.7' });

    expect(result.orderNumber).toMatch(/^AUR-\d{6,}$/);
    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: true, payments: true, events: true },
    });
    // Born placed: waiting for staff, never confirmed (ADR-015, INV-O1).
    expect(order.status).toBe('placed');
    expect(order.confirmedBy).toBeNull();
    expect(order.confirmedAt).toBeNull();
    expect(order.paymentStatus).toBe('unpaid');
    expect(order.channel).toBe('web');
    // Dhaka zone: 2 x 2,500 = 5,000 reaches the free-delivery threshold exactly.
    expect(order.subtotalMinor).toBe(500000n);
    expect(order.shippingChargedMinor).toBe(0n);
    expect(order.totalMinor).toBe(500000n);

    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      titleSnapshot: 'Oxford shirt',
      skuSnapshot: variant.sku,
      unitPriceMinor: 250000n,
      unitCostMinor: 90000n,
      quantity: 2,
      totalMinor: 500000n,
    });
    expect(order.items[0]!.optionsSnapshot).toEqual([{ name: 'Size', value: 'M' }]);

    expect(order.payments).toHaveLength(1);
    expect(order.payments[0]).toMatchObject({
      provider: 'cod',
      method: 'cash',
      status: 'pending',
      amountMinor: 500000n,
    });
    expect(order.events.map((e) => e.type)).toEqual(['placed']);

    const level = await db.inventoryLevel.findFirstOrThrow({
      where: { variantId: variant.variantId },
    });
    expect(level).toMatchObject({ onHand: 3, reserved: 0 });
    const sale = await db.stockMovement.findFirstOrThrow({
      where: { variantId: variant.variantId, type: 'sale' },
    });
    expect(sale).toMatchObject({
      quantity: -2,
      referenceType: 'order',
      referenceId: result.orderId,
    });
    expect(await findLedgerMismatches()).toEqual([]);

    const outbox = await db.outboxEvent.findMany({ where: { type: 'order.placed' } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.aggregateId).toBe(result.orderId);
    // Ids and amounts only (INV-A9): no phone, email or name.
    expect(JSON.stringify(outbox[0]!.payload)).not.toMatch(/ayaan|@|017/i);

    // The bag is empty afterwards.
    expect(await db.cartItem.count()).toBe(0);
  });

  it('charges delivery by zone and rate: inside, outside, and free over the threshold', async () => {
    const areas = await areaIds();
    const cheap = await makeSellableVariant({ stock: 20, priceMinor: 100000n });
    const inside = await submit(await bag(cheap, 1), input(areas), { ip: null });
    const outside = await submit(await bag(cheap, 1), input(areas, {}, 'cumilla'), { ip: null });
    const free = await submit(await bag(cheap, 5), input(areas, {}, 'cumilla'), { ip: null });
    const rows = await db.order.findMany({ orderBy: { createdAt: 'asc' } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(inside.orderId)!.shippingChargedMinor).toBe(8000n);
    expect(byId.get(outside.orderId)!.shippingChargedMinor).toBe(13000n);
    expect(byId.get(free.orderId)!.shippingChargedMinor).toBe(0n);
    expect(byId.get(free.orderId)!.totalMinor).toBe(500000n);
    expect(byId.get(outside.orderId)!.totalMinor).toBe(113000n);
  });

  it('reprices everything from the database, whatever the page showed (INV-M3)', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5, priceMinor: 100000n });
    const identity = await bag(variant, 1);
    // The price changes after the shopper added it to the bag.
    await db.productVariant.update({
      where: { id: variant.variantId },
      data: { priceMinor: 130000n },
    });
    const result = await submit(identity, input(areas), { ip: null });
    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: true },
    });
    expect(order.items[0]!.unitPriceMinor).toBe(130000n);
    expect(order.subtotalMinor).toBe(130000n);
  });

  it('refuses forged price, total, discount and shipping fields in the request (INV-O8)', () => {
    const base = {
      idempotencyKey: 'abcdefgh-1234',
      contact: { name: 'Ayaan', phone: '01712345678' },
      address: {
        divisionId: '0192f7c2-8b1a-7c3e-9d4f-1a2b3c4d5e6f',
        districtId: '0192f7c2-8b1a-7c3e-9d4f-1a2b3c4d5e70',
        area: 'Section 10',
        line1: 'House 1, Road 4',
      },
      paymentMethod: 'cod',
    };
    expect(placeOrderSchema.safeParse(base).success).toBe(true);
    for (const forged of [
      { ...base, totalMinor: '1' },
      { ...base, subtotal: 1 },
      { ...base, discountMinor: 99999 },
      { ...base, shippingChargedMinor: 0 },
      { ...base, items: [{ variantId: base.address.divisionId, unitPriceMinor: 1 }] },
      { ...base, contact: { ...base.contact, price: 1 } },
      { ...base, address: { ...base.address, shippingFee: 0 } },
      { ...base, paymentMethod: 'sslcommerz' },
    ]) {
      expect(placeOrderSchema.safeParse(forged).success).toBe(false);
    }
  });

  it('later catalog edits never change a placed order (INV-O5)', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({
      stock: 5,
      priceMinor: 250000n,
      costMinor: 90000n,
      title: 'Original name',
    });
    const result = await submit(await bag(variant, 1), input(areas), { ip: null });
    await db.productVariant.update({
      where: { id: variant.variantId },
      data: { priceMinor: 999999n, avgCostMinor: 1n, sku: 'CHANGED' },
    });
    await db.product.update({ where: { id: variant.productId }, data: { title: 'Renamed' } });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: result.orderId } });
    expect(item).toMatchObject({
      titleSnapshot: 'Original name',
      unitPriceMinor: 250000n,
      unitCostMinor: 90000n,
      skuSnapshot: variant.sku,
    });
  });

  it('is idempotent: the same key returns the same order and sells once (INV-O6)', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    const identity = await bag(variant, 2);
    const body = input(areas);
    const first = await submit(identity, body, { ip: null });
    const again = await submit(identity, body, { ip: null });
    expect(again.orderId).toBe(first.orderId);
    expect(again.orderNumber).toBe(first.orderNumber);
    expect(again.replayed).toBe(true);
    expect(again.trackingToken).toBe(first.trackingToken);
    expect(await db.order.count()).toBe(1);
    expect(
      await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.variantId } }),
    ).toMatchObject({ onHand: 3 });
    expect(await db.outboxEvent.count({ where: { type: 'order.placed' } })).toBe(1);
  });

  it('rejects the same key for a different request and does not share keys between customers', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 9 });
    const identity = await bag(variant, 1);
    const body = input(areas);
    await submit(identity, body, { ip: null });
    const different = { ...body, contact: { ...body.contact, name: 'Someone Else' } };
    expect(await errorCode(submit(identity, different, { ip: null }))).toContain(
      'IDEMPOTENCY_KEY_REUSED',
    );

    // Another customer using the same key string is a different actor: a separate order, no replay.
    const other = await bag(variant, 1);
    const second = await submit(
      other,
      { ...body, contact: { ...body.contact, phone: nextPhone() } },
      { ip: null },
    );
    expect(second.replayed).toBe(false);
    expect(await db.order.count()).toBe(2);
  });

  it('two parallel submits of one bag with one key create exactly one order', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    const identity = await bag(variant, 1);
    const body = input(areas);
    const results = await Promise.all([
      submit(identity, body, { ip: null }),
      submit(identity, body, { ip: null }),
    ]);
    expect(new Set(results.map((r) => r.orderId)).size).toBe(1);
    expect(await db.order.count()).toBe(1);
    expect(
      await db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.variantId } }),
    ).toMatchObject({ onHand: 4 });
  });

  it('never oversells the last units under parallel checkouts (INV-S2)', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 3 });
    const buyers = await Promise.all(Array.from({ length: 8 }, () => bag(variant, 1)));
    const outcomes = await Promise.allSettled(
      buyers.map((identity) => submit(identity, input(areas), { ip: null })),
    );
    const won = outcomes.filter((o) => o.status === 'fulfilled');
    const lost = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');
    expect(won).toHaveLength(3);
    for (const failure of lost) {
      expect(isDomainError(failure.reason) && failure.reason.code).toBe('OUT_OF_STOCK');
    }
    expect(await db.order.count()).toBe(3);
    const level = await db.inventoryLevel.findFirstOrThrow({
      where: { variantId: variant.variantId },
    });
    expect(level).toMatchObject({ onHand: 0, reserved: 0 });
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('tells staff once per hour when a customer hits a variant without a cost, and sells it after a cost is set', async () => {
    const areas = await areaIds();
    const noCost = await makeSellableVariant({ stock: 5, costMinor: 0n, title: 'Costless shirt' });
    const { user } = await makeStaff({ role: 'manager' });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await errorCode(submit(await bag(noCost), input(areas), { ip: null }))).toMatch(
        /^CONFLICT: Costless shirt .*cannot be ordered online/,
      );
    }
    const alerts = await db.auditLog.findMany({
      where: { action: 'checkout.no_cost_refused', entityId: noCost.variantId },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ entityType: 'variant', actorId: null });

    await setCostBasis(
      { scope: { kind: 'variant', variantId: noCost.variantId }, unitCost: '900' },
      { userId: user.id },
    );
    const placed = await submit(await bag(noCost), input(areas), { ip: null });
    expect(placed.orderNumber).toBeTruthy();
    const item = await db.orderItem.findFirstOrThrow({ where: { variantId: noCost.variantId } });
    expect(item.unitCostMinor).toBe(90000n);
  });

  it('refuses a variant with no cost basis, an unpublished product and sold out stock, leaving no trace', async () => {
    const areas = await areaIds();
    const noCost = await makeSellableVariant({ stock: 5, costMinor: 0n, title: 'No cost shirt' });
    const soldOut = await makeSellableVariant({ stock: 1, title: 'Last shirt' });
    const draftLater = await makeSellableVariant({ stock: 5 });

    expect(await errorCode(submit(await bag(noCost), input(areas), { ip: null }))).toMatch(
      /^CONFLICT: No cost shirt .*cannot be ordered online/,
    );

    const identity = await bag(soldOut);
    await db.inventoryLevel.updateMany({
      where: { variantId: soldOut.variantId },
      data: { onHand: 0 },
    });
    expect(await errorCode(submit(identity, input(areas), { ip: null }))).toMatch(
      /^OUT_OF_STOCK: Last shirt .*sold out/,
    );

    const draftBag = await bag(draftLater);
    await db.product.update({ where: { id: draftLater.productId }, data: { status: 'draft' } });
    expect(await errorCode(submit(draftBag, input(areas), { ip: null }))).toMatch(
      /^CONFLICT: .*no longer available/,
    );

    expect(await db.order.count()).toBe(0);
    expect(await db.stockMovement.count({ where: { type: 'sale' } })).toBe(0);
    expect(await db.outboxEvent.count({ where: { type: 'order.placed' } })).toBe(0);
  });

  it('refuses a district that is not in the chosen division and a thana of another district', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    // Cumilla is not in the Dhaka division: both ids come from the known lists, so the pair is checked.
    const forged = input(areas, {
      address: {
        ...input(areas).address,
        divisionId: areas.dhaka.divisionId,
        districtId: areas.cumilla.districtId,
        thanaId: null,
        thanaName: 'Anywhere',
      },
    });
    expect(await errorCode(submit(await bag(variant), forged, { ip: null }))).toMatch(
      /^VALIDATION/,
    );
    if (areas.dhaka.thanaId) {
      // A listed Dhaka thana cannot belong to Cumilla.
      const wrongThana = input(areas, {
        address: {
          ...input(areas).address,
          divisionId: areas.cumilla.divisionId,
          districtId: areas.cumilla.districtId,
          thanaId: areas.dhaka.thanaId,
        },
      });
      expect(await errorCode(submit(await bag(variant), wrongThana, { ip: null }))).toMatch(
        /^VALIDATION/,
      );
    }
    expect(await db.order.count()).toBe(0);
  });

  it('refuses an empty bag and accepts a free-text thana (addresses never block an order)', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    expect(
      await errorCode(submit({ userId: null, token: null }, input(areas), { ip: null })),
    ).toMatch(/^VALIDATION/);
    // Free text works when the thana is not listed.
    const typed = input(areas, {
      address: { ...input(areas).address, thanaId: null, thanaName: 'Uttar Badda' },
    });
    const result = await submit(await bag(variant), typed, { ip: null });
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect((order.shippingAddress as { thana: { name: string } }).thana.name).toBe('Uttar Badda');
  });
});

describe('cash on delivery rules (5.2)', () => {
  it('enforces the maximum amount on the server', async () => {
    const areas = await areaIds();
    const owner = await makeStaff({ role: 'owner' });
    await saveCheckoutSettings(
      {
        otpRequired: false,
        maxOpenOrdersPerPhone: 3,
        maxOrdersPerPhonePerDay: 5,
        maxOpenOrdersPerAddress: 3,
        maxOrdersPerIpPerDay: 8,
        maxUnitsPerVariantPerPhone: 6,
        codEnabled: true,
        codMaxOrder: '3000',
      },
      { userId: owner.user.id },
    );
    const variant = await makeSellableVariant({ stock: 9, priceMinor: 250000n });
    expect(await errorCode(submit(await bag(variant, 2), input(areas), { ip: null }))).toMatch(
      /^VALIDATION: Cash on delivery is available for orders up to ৳3,000/,
    );
    const small = await submit(await bag(variant, 1), input(areas), { ip: null });
    expect(small.orderNumber).toMatch(/^AUR-/);
    const audit = await db.auditLog.findFirst({ where: { action: 'setting.update' } });
    expect(audit).toBeTruthy();
  });

  it('refuses cash on delivery where the zone does not allow it and when it is switched off', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 9 });
    await db.shippingRate.updateMany({
      where: { zone: { isFallback: true } },
      data: { codAllowed: false },
    });
    expect(
      await errorCode(submit(await bag(variant), input(areas, {}, 'cumilla'), { ip: null })),
    ).toMatch(/^VALIDATION: Cash on delivery is not available for this delivery area/);
    const summary = await summarize(await bag(variant), {
      divisionId: areas.cumilla.divisionId,
      districtId: areas.cumilla.districtId,
    });
    expect(summary.methods[0]).toMatchObject({ id: 'cod', available: false });

    const owner = await makeStaff({ role: 'owner' });
    await saveCheckoutSettings(
      {
        otpRequired: false,
        maxOpenOrdersPerPhone: 3,
        maxOrdersPerPhonePerDay: 5,
        maxOpenOrdersPerAddress: 3,
        maxOrdersPerIpPerDay: 8,
        maxUnitsPerVariantPerPhone: 6,
        codEnabled: false,
        codMaxOrder: '50000',
      },
      { userId: owner.user.id },
    );
    expect(await errorCode(submit(await bag(variant), input(areas), { ip: null }))).toMatch(
      /^VALIDATION: Cash on delivery is not available right now/,
    );
  });
});

describe('abuse protection (4.8, INV-O11)', () => {
  it('limits open orders per phone; staff cancelling is the release valve', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 30 });
    const phone = nextPhone();
    const placed: SubmitResult[] = [];
    for (let i = 0; i < 3; i += 1) {
      placed.push(
        await submit(await bag(variant), input(areas, { contact: { name: 'A B', phone } }), {
          ip: null,
        }),
      );
    }
    expect(
      await errorCode(
        submit(await bag(variant), input(areas, { contact: { name: 'A B', phone } }), { ip: null }),
      ),
    ).toMatch(/^RATE_LIMITED: You already have orders waiting/);
    // A staff cancellation frees the slot (the system never cancels by itself).
    await db.order.update({
      where: { id: placed[0]!.orderId },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'customer_cancelled' },
    });
    const next = await submit(
      await bag(variant),
      input(areas, { contact: { name: 'A B', phone } }),
      { ip: null },
    );
    expect(next.orderNumber).toMatch(/^AUR-/);
  });

  it('limits orders to one delivery address across phones, and per network address', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 40 });
    const sameAddress = input(areas).address;
    for (let i = 0; i < 3; i += 1) {
      await submit(await bag(variant), input(areas, { address: sameAddress }), { ip: null });
    }
    expect(
      await errorCode(
        submit(await bag(variant), input(areas, { address: sameAddress }), { ip: null }),
      ),
    ).toMatch(/^RATE_LIMITED/);

    for (let i = 0; i < 8; i += 1) {
      await submit(await bag(variant), input(areas), { ip: '198.51.100.20' });
    }
    expect(
      await errorCode(submit(await bag(variant), input(areas), { ip: '198.51.100.20' })),
    ).toMatch(/^RATE_LIMITED: There have been several orders from this connection/);
    // A different address is unaffected.
    expect(
      (await submit(await bag(variant), input(areas), { ip: '198.51.100.21' })).orderNumber,
    ).toMatch(/^AUR-/);
  });

  it('caps units of one variant held per phone while orders wait (stock cannot be hoarded)', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 40 });
    const phone = nextPhone();
    await submit(await bag(variant, 5), input(areas, { contact: { name: 'A B', phone } }), {
      ip: null,
    });
    expect(
      await errorCode(
        submit(await bag(variant, 2), input(areas, { contact: { name: 'A B', phone } }), {
          ip: null,
        }),
      ),
    ).toMatch(/^RATE_LIMITED: .*limited to 6 pieces/);
    expect(
      (
        await submit(await bag(variant, 1), input(areas, { contact: { name: 'A B', phone } }), {
          ip: null,
        })
      ).orderNumber,
    ).toMatch(/^AUR-/);
  });

  it('serialises parallel checkouts of one phone so the limit holds exactly', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 40 });
    const phone = nextPhone();
    const buyers = await Promise.all(Array.from({ length: 6 }, () => bag(variant, 1)));
    const outcomes = await Promise.allSettled(
      buyers.map((identity) =>
        submit(identity, input(areas, { contact: { name: 'A B', phone } }), { ip: null }),
      ),
    );
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(3);
    expect(await db.order.count({ where: { phone: `+880${phone.slice(1)}` } })).toBe(3);
  });

  it('blocks phones on the risk list with one generic message and no trace; expired flags do not block', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 20 });
    const phone = nextPhone();
    const e164 = `+880${phone.slice(1)}`;
    await db.customerRiskFlag.create({
      data: { phone: e164, type: 'fake_order', note: 'prank orders' },
    });
    const failure = await errorCode(
      submit(await bag(variant), input(areas, { contact: { name: 'A B', phone } }), { ip: null }),
    );
    expect(failure).toMatch(/^FORBIDDEN: We are unable to take this order online/);
    expect(failure).not.toMatch(/prank|fake/i);
    expect(await db.order.count()).toBe(0);

    await db.customerRiskFlag.updateMany({
      where: { phone: e164 },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await submit(await bag(variant), input(areas, { contact: { name: 'A B', phone } }), {
          ip: null,
        })
      ).orderNumber,
    ).toMatch(/^AUR-/);

    // A manual flag does not block; it raises the risk score for staff.
    const other = nextPhone();
    await db.customerRiskFlag.create({ data: { phone: `+880${other.slice(1)}`, type: 'manual' } });
    const placed = await submit(
      await bag(variant),
      input(areas, { contact: { name: 'A B', phone: other } }),
      { ip: null },
    );
    const order = await db.order.findUniqueOrThrow({ where: { id: placed.orderId } });
    expect(order.riskFlags).toContain('flag_on_record');
    expect(order.riskScore).toBeGreaterThan(0);
  });

  it('requires a phone code when switched on, accepts it once, and never logs it in the database', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 20 });
    const owner = await makeStaff({ role: 'owner' });
    await saveCheckoutSettings(
      {
        otpRequired: true,
        maxOpenOrdersPerPhone: 3,
        maxOrdersPerPhonePerDay: 5,
        maxOpenOrdersPerAddress: 3,
        maxOrdersPerIpPerDay: 8,
        maxUnitsPerVariantPerPhone: 6,
        codEnabled: true,
        codMaxOrder: '50000',
      },
      { userId: owner.user.id },
    );
    const phone = nextPhone();
    const body = () => input(areas, { contact: { name: 'A B', phone } });

    expect(await errorCode(submit(await bag(variant), body(), { ip: null }))).toMatch(
      /^VALIDATION: Please confirm your phone number/,
    );

    expect(await requestOtp(phone)).toEqual({ sent: true, required: true });
    const sms = getLoggedSms().at(-1)!;
    expect(sms.to).toBe(`+880${phone.slice(1)}`);
    const code = /(\d{6})/.exec(sms.text)![1]!;
    expect(JSON.stringify(await db.verification.findMany())).not.toContain(code);

    expect(await errorCode(verifyOtp(phone, code === '000000' ? '111111' : '000000'))).toMatch(
      /^VALIDATION: That code is not right/,
    );
    await verifyOtp(phone, code);
    const placed = await submit(await bag(variant), body(), { ip: null });
    expect(placed.orderNumber).toMatch(/^AUR-/);
    // The proof is spent: the next order needs a new code.
    expect(await errorCode(submit(await bag(variant), body(), { ip: null }))).toMatch(
      /^VALIDATION: Please confirm your phone number/,
    );
  });

  it('does nothing about codes when they are off (the default)', async () => {
    expect(await requestOtp(nextPhone())).toEqual({ sent: false, required: false });
    expect(getLoggedSms()).toHaveLength(0);
  });
});

describe('the database guards verification (INV-O9) and order arithmetic (INV-M4)', () => {
  async function placeOne() {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    return submit(await bag(variant), input(areas), { ip: null });
  }

  it('refuses confirmed without a verifier, with a non-verifier, and accepts a real verifier once', async () => {
    const placed = await placeOne();
    const confirm = (data: string) =>
      db.$executeRawUnsafe(`UPDATE orders SET ${data} WHERE id = '${placed.orderId}'::uuid`);

    await expect(confirm(`status = 'confirmed'`)).rejects.toThrow(
      /orders_confirmed_requires_verifier_check/,
    );
    await expect(confirm(`status = 'shipped'`)).rejects.toThrow(
      /orders_confirmed_requires_verifier_check/,
    );

    const fulfilment = await makeStaff({ role: 'fulfillment' });
    await expect(
      confirm(
        `status = 'confirmed', confirmed_by = '${fulfilment.member.id}'::uuid, confirmed_at = now()`,
      ),
    ).rejects.toThrow(/may verify orders/);
    const inactive = await makeStaff({ role: 'order_verifier', active: false });
    await expect(
      confirm(
        `status = 'confirmed', confirmed_by = '${inactive.member.id}'::uuid, confirmed_at = now()`,
      ),
    ).rejects.toThrow(/may verify orders/);

    const verifier = await makeStaff({ role: 'order_verifier' });
    await confirm(
      `status = 'confirmed', confirmed_by = '${verifier.member.id}'::uuid, confirmed_at = now()`,
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: placed.orderId } })).status).toBe(
      'confirmed',
    );

    // The verifier on record cannot be swapped or erased.
    const other = await makeStaff({ role: 'manager' });
    await expect(confirm(`confirmed_by = '${other.member.id}'::uuid`)).rejects.toThrow(
      /cannot be changed/,
    );
    await expect(confirm(`confirmed_by = NULL, status = 'placed'`)).rejects.toThrow(
      /cannot be changed/,
    );
  });

  it('refuses to insert an order that is already confirmed without a verifier, or with a wrong total', async () => {
    const placed = await placeOne();
    const copy = (status: string, total: string) =>
      db.$executeRawUnsafe(`
        INSERT INTO orders (id, phone, customer_name, status, currency, subtotal_minor, shipping_charged_minor, total_minor,
                            shipping_address, shipping_method, tracking_token_hash, address_hash, updated_at)
        VALUES (gen_random_uuid(), '+8801700000000', 'X', '${status}', 'BDT', 1000, 0, ${total}, '{}', '{}', 'h-${Math.random()}', 'a', now())`);
    await expect(copy('confirmed', '1000')).rejects.toThrow(
      /orders_confirmed_requires_verifier_check/,
    );
    await expect(copy('placed', '999')).rejects.toThrow(/orders_amounts_check/);
    await copy('placed', '1000');
    expect(placed.orderId).toBeTruthy();
  });

  it('item totals must equal price times quantity', async () => {
    const placed = await placeOne();
    await expect(
      db.$executeRawUnsafe(
        `UPDATE order_items SET total_minor = total_minor + 1 WHERE order_id = '${placed.orderId}'::uuid`,
      ),
    ).rejects.toThrow(/order_items_check/);
  });

  it('the timeline is append-only', async () => {
    const placed = await placeOne();
    await expect(
      db.$executeRawUnsafe(
        `UPDATE order_events SET type = 'x' WHERE order_id = '${placed.orderId}'::uuid`,
      ),
    ).rejects.toThrow();
    await expect(
      db.$executeRawUnsafe(`DELETE FROM order_events WHERE order_id = '${placed.orderId}'::uuid`),
    ).rejects.toThrow();
  });

  it('no job cancels or confirms an order by itself (INV-O1, INV-O2)', async () => {
    const placed = await placeOne();
    await db.order.update({
      where: { id: placed.orderId },
      data: { placedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    });
    await releaseExpired();
    await purgeExpired();
    const order = await db.order.findUniqueOrThrow({ where: { id: placed.orderId } });
    expect(order.status).toBe('placed');
    expect(order.cancelledAt).toBeNull();
    expect(order.confirmedBy).toBeNull();
  });
});

describe('guest order access (4.7, INV-O10)', () => {
  it('derives a 128 bit token, stores only its hash, and never leaks it into records', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    const body = input(areas);
    const placed = await submit(await bag(variant), body, { ip: null });
    const token = placed.trackingToken;
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(token).toBe(trackingTokenFor(placed.orderId));
    const order = await db.order.findUniqueOrThrow({ where: { id: placed.orderId } });
    expect(order.trackingTokenHash).toBe(sha256(token));
    expect(order.trackingTokenHash).not.toContain(token);
    // Not in the idempotency response, the outbox, the timeline or the audit log.
    const stored = JSON.stringify([
      await db.idempotencyKey.findMany(),
      await db.outboxEvent.findMany(),
      await db.orderEvent.findMany(),
      await db.auditLog.findMany(),
    ]);
    expect(stored).not.toContain(token);
    expect(await orderIdForToken(token)).toBe(placed.orderId);
    expect(await orderIdForToken('A'.repeat(22))).toBeNull();
  });

  it('needs a second factor: wrong phone, wrong email, malformed and unknown token all fail the same way', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    const body = input(areas);
    const placed = await submit(await bag(variant), body, { ip: null });
    const token = placed.trackingToken;

    expect(await verifyTokenFactor(token, body.contact.phone)).toBe(placed.orderId);
    expect(await verifyTokenFactor(token, '+880 ' + body.contact.phone.slice(1))).toBe(
      placed.orderId,
    );
    expect(await verifyTokenFactor(token, 'AYAAN@example.com')).toBe(placed.orderId);
    expect(await verifyTokenFactor(token, '01799999999')).toBeNull();
    expect(await verifyTokenFactor(token, 'other@example.com')).toBeNull();
    expect(await verifyTokenFactor(token, 'not a factor')).toBeNull();
    expect(await verifyTokenFactor('B'.repeat(22), body.contact.phone)).toBeNull();

    // Without proof the full order is withheld; with proof it is shown.
    expect(await viewForToken(token, () => false)).toBeNull();
    const view = await viewForToken(token, (id) => id === placed.orderId);
    expect(view?.orderNumber).toBe(placed.orderNumber);
    expect(view?.items).toHaveLength(1);
    expect(view?.address.lines.join(' ')).toContain('Road 4');
  });

  it('order number plus phone or email shows the status and nothing else; a number alone shows nothing', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    const body = input(areas);
    const placed = await submit(await bag(variant), body, { ip: null });

    const minimal = await lookupMinimal(placed.orderNumber, body.contact.phone);
    expect(minimal).toMatchObject({
      orderNumber: placed.orderNumber,
      status: 'placed',
      statusLabel: 'Awaiting verification',
    });
    expect(Object.keys(minimal!).sort()).toEqual([
      'orderNumber',
      'placedAt',
      'status',
      'statusLabel',
      'timeline',
    ]);
    expect(
      await lookupMinimal(placed.orderNumber.toLowerCase(), 'ayaan@example.com'),
    ).not.toBeNull();
    expect(await lookupMinimal(placed.orderNumber, '01700000000')).toBeNull();
    expect(await lookupMinimal(placed.orderNumber, '')).toBeNull();
    expect(await lookupMinimal('AUR-999999', body.contact.phone)).toBeNull();
  });
});

describe('order received email (4.7, 13.1)', () => {
  it('sends once from the order.placed event, masked in the send log, and is safe to re-deliver', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5, title: 'Oxford shirt' });
    const body = input(areas);
    const placed = await submit(await bag(variant), body, { ip: null });
    const event = await db.outboxEvent.findFirstOrThrow({ where: { type: 'order.placed' } });
    const envelope = { outboxId: event.id, payload: event.payload };

    expect(await handleOrderPlaced(envelope)).toEqual({ result: 'sent' });
    expect(await handleOrderPlaced(envelope)).toEqual({ result: 'skipped' });
    const mails = getLoggedEmails();
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe('ayaan@example.com');
    expect(mails[0]!.subject).toContain(placed.orderNumber);
    expect(mails[0]!.text).toContain('personally confirm');
    expect(mails[0]!.html).toContain(`/track/${placed.trackingToken}`);
    expect(mails[0]!.html).toContain('Oxford shirt');

    const logs = await db.notificationLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      channel: 'email',
      template: 'order_received',
      status: 'sent',
      relatedId: placed.orderId,
    });
    expect(logs[0]!.toMasked).toBe('a***@example.com');
  });

  it('skips an order without an email address and says so in the log', async () => {
    const areas = await areaIds();
    const variant = await makeSellableVariant({ stock: 5 });
    const body = input(areas, { contact: { name: 'A B', phone: nextPhone() } });
    await submit(await bag(variant), body, { ip: null });
    const event = await db.outboxEvent.findFirstOrThrow({ where: { type: 'order.placed' } });
    expect(await handleOrderPlaced({ outboxId: event.id, payload: event.payload })).toEqual({
      result: 'skipped',
    });
    expect(getLoggedEmails()).toHaveLength(0);
    expect((await db.notificationLog.findFirstOrThrow()).status).toBe('skipped');
  });
});
