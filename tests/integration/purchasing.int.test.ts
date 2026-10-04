import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { isDomainError } from '@/lib/errors';
import { findLedgerMismatches } from '@/modules/inventory/service';
import { buildPurchaseOrderPdf } from '@/modules/purchasing/pdf';
import { getPurchaseOrderForAdmin } from '@/modules/purchasing/queries';
import {
  addLandedCost,
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  placeOrder,
  receiveGoods,
  removeLandedCost,
  updatePurchaseOrder,
  updateSupplier,
} from '@/modules/purchasing/service';
import { makeStaff } from '../factories';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(closeDatabase);

async function setup() {
  const { user } = await makeStaff({ role: 'manager' });
  const actor = { userId: user.id };
  await db.location.create({ data: { name: 'Main', isDefault: true } });
  const product = await db.product.create({ data: { slug: 'po-shirt', title: 'Oxford shirt' } });
  const a = await db.productVariant.create({
    data: { productId: product.id, sku: 'OX-A', priceMinor: 500000n },
  });
  const b = await db.productVariant.create({
    data: { productId: product.id, sku: 'OX-B', priceMinor: 600000n },
  });
  const supplier = (await createSupplier({ name: 'Dhaka Garments' }, actor)).data;
  return { actor, a, b, supplierId: supplier.id };
}

async function code(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    return isDomainError(error) ? error.code : `unexpected: ${String(error)}`;
  }
  return 'no error';
}

let keyCounter = 0;
const key = () => `receive-key-${++keyCounter}-${Date.now()}`;

async function orderedPo(ctx: Awaited<ReturnType<typeof setup>>) {
  const created = await createPurchaseOrder(
    {
      supplierId: ctx.supplierId,
      lines: [
        { variantId: ctx.a.id, quantityOrdered: 10, unitCost: '1000.00' },
        { variantId: ctx.b.id, quantityOrdered: 5, unitCost: '2000' },
      ],
    },
    ctx.actor,
  );
  await addLandedCost(
    { poId: created.data.id, type: 'freight', amount: '1500', method: 'by_value' },
    ctx.actor,
  );
  await addLandedCost(
    { poId: created.data.id, type: 'customs_duty', amount: '1000', method: 'by_quantity' },
    ctx.actor,
  );
  await placeOrder(created.data.id, ctx.actor);
  const items = await db.purchaseOrderItem.findMany({ where: { poId: created.data.id } });
  const item = (variantId: string) => items.find((entry) => entry.variantId === variantId)!;
  return { poId: created.data.id, itemA: item(ctx.a.id), itemB: item(ctx.b.id) };
}

describe('suppliers and purchase orders', () => {
  it('creates numbered purchase orders in draft with audit rows', async () => {
    const ctx = await setup();
    const first = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 3, unitCost: '10' }],
      },
      ctx.actor,
    );
    const second = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 1, unitCost: '10' }],
      },
      ctx.actor,
    );
    // The sequence is not reset by a table wipe, so check the shape and that it counts up.
    expect(first.data.poNumber).toMatch(/^PO-\d{4,}$/);
    expect(Number(second.data.poNumber.slice(3))).toBe(Number(first.data.poNumber.slice(3)) + 1);
    const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: first.data.id } });
    expect(po.status).toBe('draft');
    expect(await db.auditLog.count({ where: { action: 'purchase_order.create' } })).toBe(2);
  });

  it('only a draft can be edited, and an inactive supplier cannot take new orders', async () => {
    const ctx = await setup();
    const { data } = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 3, unitCost: '10' }],
      },
      ctx.actor,
    );
    await updatePurchaseOrder(
      {
        id: data.id,
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.b.id, quantityOrdered: 7, unitCost: '12.50' }],
      },
      ctx.actor,
    );
    const items = await db.purchaseOrderItem.findMany({ where: { poId: data.id } });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      variantId: ctx.b.id,
      quantityOrdered: 7,
      unitCostMinor: 1250n,
    });

    await placeOrder(data.id, ctx.actor);
    expect(
      await code(
        updatePurchaseOrder(
          {
            id: data.id,
            supplierId: ctx.supplierId,
            lines: [{ variantId: ctx.a.id, quantityOrdered: 1, unitCost: '1' }],
          },
          ctx.actor,
        ),
      ),
    ).toBe('INVALID_TRANSITION');
    expect(await code(placeOrder(data.id, ctx.actor))).toBe('INVALID_TRANSITION');

    await updateSupplier(
      { id: ctx.supplierId, name: 'Dhaka Garments', isActive: false },
      ctx.actor,
    );
    expect(
      await code(
        createPurchaseOrder(
          {
            supplierId: ctx.supplierId,
            lines: [{ variantId: ctx.a.id, quantityOrdered: 1, unitCost: '1' }],
          },
          ctx.actor,
        ),
      ),
    ).toBe('CONFLICT');
  });

  it('cancels an untouched order and refuses after receiving', async () => {
    const ctx = await setup();
    const { poId, itemA } = await orderedPo(ctx);
    await receiveGoods(
      { poId, idempotencyKey: key(), lines: [{ poItemId: itemA.id, quantity: 1 }] },
      ctx.actor,
    );
    expect(await code(cancelPurchaseOrder(poId, 'changed mind', ctx.actor))).toBe(
      'INVALID_TRANSITION',
    );
    const other = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 1, unitCost: '5' }],
      },
      ctx.actor,
    );
    await cancelPurchaseOrder(other.data.id, undefined, ctx.actor);
    const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: other.data.id } });
    expect(po.status).toBe('cancelled');
  });
});

describe('landed costs (INV-F3)', () => {
  it('spreads freight by value and duty by quantity, and the allocations sum to the costs', async () => {
    const ctx = await setup();
    const { poId, itemA, itemB } = await orderedPo(ctx);
    const detail = await getPurchaseOrderForAdmin(poId);
    expect(detail?.totals.landed).toContain('2,500');
    const line = (id: string) => detail?.lines.find((entry) => entry.id === id);
    // Freight 1,500 splits 750 / 750 (equal value); duty 1,000 splits 666.67 / 333.33.
    expect(line(itemA.id)?.landedShare).toContain('1,416.67');
    expect(line(itemB.id)?.landedShare).toContain('1,083.33');
  });

  it('refuses a cost that cannot be spread, and removing a cost after receipt', async () => {
    const ctx = await setup();
    const free = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 3, unitCost: '0' }],
      },
      ctx.actor,
    );
    expect(
      await code(
        addLandedCost(
          { poId: free.data.id, type: 'freight', amount: '100', method: 'by_value' },
          ctx.actor,
        ),
      ),
    ).toBe('VALIDATION');

    const { poId, itemA } = await orderedPo(ctx);
    const cost = await db.landedCost.findFirstOrThrow({ where: { poId } });
    await receiveGoods(
      { poId, idempotencyKey: key(), lines: [{ poItemId: itemA.id, quantity: 2 }] },
      ctx.actor,
    );
    expect(await code(removeLandedCost(cost.id, ctx.actor))).toBe('INVALID_TRANSITION');
  });
});

describe('goods receipt and weighted average cost (INV-F3, INV-S3)', () => {
  it('receives partially then fully, writes receipt movements and recalculates the average', async () => {
    const ctx = await setup();
    const { poId, itemA } = await orderedPo(ctx);

    const first = await receiveGoods(
      { poId, idempotencyKey: key(), lines: [{ poItemId: itemA.id, quantity: 4 }] },
      ctx.actor,
    );
    expect(first.data.status).toBe('partially_received');
    expect(first.tags).toEqual(expect.arrayContaining([`stock:${ctx.a.id}`, 'stock']));
    // 4 units: 4 x 1,000.00 + floor(141,667 x 4 / 10) = 400,000 + 56,666 over 4 units -> 114,166.
    let variant = await db.productVariant.findUniqueOrThrow({ where: { id: ctx.a.id } });
    expect(variant.avgCostMinor).toBe(114166n);
    expect(
      await db.inventoryLevel.findFirstOrThrow({ where: { variantId: ctx.a.id } }),
    ).toMatchObject({
      onHand: 4,
    });

    const second = await receiveGoods(
      { poId, idempotencyKey: key(), lines: [{ poItemId: itemA.id, quantity: 6 }] },
      ctx.actor,
    );
    expect(second.data.status).toBe('partially_received'); // line B still outstanding
    variant = await db.productVariant.findUniqueOrThrow({ where: { id: ctx.a.id } });
    expect(variant.avgCostMinor).toBe(114166n);

    // Line A carried exactly its landed cost over both deliveries.
    const carried = await db.goodsReceiptItem.aggregate({
      where: { poItemId: itemA.id },
      _sum: { landedCostMinor: true },
    });
    expect(carried._sum.landedCostMinor).toBe(141667n);

    const itemB = await db.purchaseOrderItem.findFirstOrThrow({
      where: { poId, variantId: ctx.b.id },
    });
    const last = await receiveGoods(
      { poId, idempotencyKey: key(), lines: [{ poItemId: itemB.id, quantity: 5 }] },
      ctx.actor,
    );
    expect(last.data.status).toBe('received');
    const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    expect(po.status).toBe('received');
    expect(
      await db.stockMovement.count({ where: { type: 'receipt', referenceType: 'goods_receipt' } }),
    ).toBe(3);
    expect(await findLedgerMismatches()).toEqual([]);
    expect(await db.auditLog.count({ where: { action: 'purchase_order.receive' } })).toBe(3);
    const events = await db.outboxEvent.findMany({ where: { type: 'purchase_order.received' } });
    expect(events).toHaveLength(3);
    expect(JSON.stringify(events[0]?.payload)).not.toMatch(/@|name/);
  });

  it('blends with stock already on hand', async () => {
    const ctx = await setup();
    const first = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 20, unitCost: '1000' }],
      },
      ctx.actor,
    );
    await placeOrder(first.data.id, ctx.actor);
    const firstItem = await db.purchaseOrderItem.findFirstOrThrow({
      where: { poId: first.data.id },
    });
    await receiveGoods(
      {
        poId: first.data.id,
        idempotencyKey: key(),
        lines: [{ poItemId: firstItem.id, quantity: 20 }],
      },
      ctx.actor,
    );
    const second = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 10, unitCost: '1300' }],
      },
      ctx.actor,
    );
    await placeOrder(second.data.id, ctx.actor);
    const secondItem = await db.purchaseOrderItem.findFirstOrThrow({
      where: { poId: second.data.id },
    });
    await receiveGoods(
      {
        poId: second.data.id,
        idempotencyKey: key(),
        lines: [{ poItemId: secondItem.id, quantity: 10 }],
      },
      ctx.actor,
    );
    const variant = await db.productVariant.findUniqueOrThrow({ where: { id: ctx.a.id } });
    expect(variant.avgCostMinor).toBe(110_000n); // (20 x 1000 + 10 x 1300) / 30 = 1,100.00
  });

  it('a cancelled order cannot receive goods', async () => {
    const ctx = await setup();
    const created = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 2, unitCost: '10' }],
      },
      ctx.actor,
    );
    const item = await db.purchaseOrderItem.findFirstOrThrow({ where: { poId: created.data.id } });
    await cancelPurchaseOrder(created.data.id, undefined, ctx.actor);
    expect(
      await code(
        receiveGoods(
          {
            poId: created.data.id,
            idempotencyKey: key(),
            lines: [{ poItemId: item.id, quantity: 1 }],
          },
          ctx.actor,
        ),
      ),
    ).toBe('INVALID_TRANSITION');
    expect(await db.stockMovement.count()).toBe(0);
  });

  it('landed cost cannot be added once a delivery has arrived (every unit carries its share)', async () => {
    const ctx = await setup();
    const { poId, itemA } = await orderedPo(ctx);
    await receiveGoods(
      { poId, idempotencyKey: key(), lines: [{ poItemId: itemA.id, quantity: 10 }] },
      ctx.actor,
    );
    expect(
      await code(
        addLandedCost({ poId, type: 'freight', amount: '100', method: 'by_quantity' }, ctx.actor),
      ),
    ).toBe('INVALID_TRANSITION');
    const carried = await db.goodsReceiptItem.aggregate({ _sum: { landedCostMinor: true } });
    expect(carried._sum.landedCostMinor).toBe(141667n);
  });

  it('audits supplier changes without free text', async () => {
    const ctx = await setup();
    await updateSupplier(
      { id: ctx.supplierId, name: 'Renamed', notes: 'owes us a call', isActive: true },
      ctx.actor,
    );
    const rows = await db.auditLog.findMany({ where: { entityType: 'supplier' } });
    expect(rows.map((row) => row.action).sort()).toEqual(['supplier.create', 'supplier.update']);
    expect(JSON.stringify(rows)).not.toContain('owes us a call');
  });

  it('refuses to over-receive, to receive a draft, or a line from another order', async () => {
    const ctx = await setup();
    const { poId, itemA } = await orderedPo(ctx);
    expect(
      await code(
        receiveGoods(
          { poId, idempotencyKey: key(), lines: [{ poItemId: itemA.id, quantity: 11 }] },
          ctx.actor,
        ),
      ),
    ).toBe('VALIDATION');
    const draft = await createPurchaseOrder(
      {
        supplierId: ctx.supplierId,
        lines: [{ variantId: ctx.a.id, quantityOrdered: 2, unitCost: '1' }],
      },
      ctx.actor,
    );
    const draftItem = await db.purchaseOrderItem.findFirstOrThrow({
      where: { poId: draft.data.id },
    });
    expect(
      await code(
        receiveGoods(
          {
            poId: draft.data.id,
            idempotencyKey: key(),
            lines: [{ poItemId: draftItem.id, quantity: 1 }],
          },
          ctx.actor,
        ),
      ),
    ).toBe('INVALID_TRANSITION');
    expect(
      await code(
        receiveGoods(
          { poId, idempotencyKey: key(), lines: [{ poItemId: draftItem.id, quantity: 1 }] },
          ctx.actor,
        ),
      ),
    ).toBe('NOT_FOUND');
    expect(await db.stockMovement.count()).toBe(0);
  });

  it('the same idempotency key receives once and replays the result', async () => {
    const ctx = await setup();
    const { poId, itemA } = await orderedPo(ctx);
    const idempotencyKey = key();
    const input = { poId, idempotencyKey, lines: [{ poItemId: itemA.id, quantity: 3 }] };
    const first = await receiveGoods(input, ctx.actor);
    const again = await receiveGoods(input, ctx.actor);
    expect(again.data.receiptId).toBe(first.data.receiptId);
    expect(again.data.replayed).toBe(true);
    expect(await db.goodsReceipt.count()).toBe(1);
    expect(
      await db.inventoryLevel.findFirstOrThrow({ where: { variantId: ctx.a.id } }),
    ).toMatchObject({
      onHand: 3,
    });
    // A different request under the same key is rejected, not applied.
    expect(
      await code(
        receiveGoods({ ...input, lines: [{ poItemId: itemA.id, quantity: 2 }] }, ctx.actor),
      ),
    ).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('concurrent receipts of the same variant from two orders serialise (no deadlock, exact average)', async () => {
    const ctx = await setup();
    const make = async (cost: string) => {
      const po = await createPurchaseOrder(
        {
          supplierId: ctx.supplierId,
          lines: [{ variantId: ctx.a.id, quantityOrdered: 10, unitCost: cost }],
        },
        ctx.actor,
      );
      await placeOrder(po.data.id, ctx.actor);
      const item = await db.purchaseOrderItem.findFirstOrThrow({ where: { poId: po.data.id } });
      return { poId: po.data.id, itemId: item.id };
    };
    const one = await make('100');
    const two = await make('200');
    await Promise.all(
      [one, two].map((entry) =>
        receiveGoods(
          {
            poId: entry.poId,
            idempotencyKey: key(),
            lines: [{ poItemId: entry.itemId, quantity: 10 }],
          },
          ctx.actor,
        ),
      ),
    );
    const variant = await db.productVariant.findUniqueOrThrow({ where: { id: ctx.a.id } });
    expect(variant.avgCostMinor).toBe(15_000n);
    expect(
      await db.inventoryLevel.findFirstOrThrow({ where: { variantId: ctx.a.id } }),
    ).toMatchObject({
      onHand: 20,
    });
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('receipts cannot be edited or deleted by the application (append-only)', async () => {
    const ctx = await setup();
    const { poId, itemA } = await orderedPo(ctx);
    const result = await receiveGoods(
      { poId, idempotencyKey: key(), lines: [{ poItemId: itemA.id, quantity: 1 }] },
      ctx.actor,
    );
    await expect(
      db.goodsReceipt.update({ where: { id: result.data.receiptId }, data: { notes: 'edited' } }),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.goodsReceiptItem.deleteMany({ where: { receiptId: result.data.receiptId } }),
    ).rejects.toThrow(/append-only/);
  });
});

describe('purchase order PDF', () => {
  it('builds a PDF for a real order', async () => {
    const ctx = await setup();
    const { poId } = await orderedPo(ctx);
    const detail = (await getPurchaseOrderForAdmin(poId))!;
    const bytes = await buildPurchaseOrderPdf({
      poNumber: detail.poNumber,
      status: detail.status,
      createdAt: new Date(detail.createdAt),
      expectedAt: null,
      supplier: detail.supplier,
      lines: detail.lines.map((line) => ({
        sku: line.sku,
        label: line.label,
        quantity: line.quantityOrdered,
        unitCost: line.unitCost,
        lineTotal: line.lineTotal,
      })),
      landedCosts: [],
      totals: detail.totals,
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
  });
});
