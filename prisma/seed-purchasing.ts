import type { PrismaClient } from '../src/generated/prisma/client';
import { newId } from '../src/lib/ids';
import { buildCatalogSeed } from './seed-data';

/**
 * Development purchasing history: one supplier and four purchase orders. Two are received in full
 * (that is where all opening stock and every variant's average cost come from), one is placed and
 * still on its way, one is a draft restock of the sold-out variants. Everything goes through the
 * real purchasing and inventory services, so the ledger, receipts, landed costs and average costs
 * are exactly what production would produce. Safe to run again: the marker note on each order makes
 * every step a no-op once done.
 */

const SUPPLIER_NAME = 'Rupayan Garments Ltd';
const MARKERS = {
  tops: 'Development seed: opening stock, tops and knitwear',
  bottoms: 'Development seed: opening stock, trousers and accessories',
  onTheWay: 'Development seed: autumn restock on its way',
  draft: 'Development seed: restock of sold-out lines (draft)',
} as const;

export interface PurchasingSeedResult {
  skipped: boolean;
  orders: number;
  receivedUnits: number;
  retiredLegacyUnits: number;
}

/**
 * Earlier seeds wrote opening stock straight into the levels. Stock now comes only from purchase
 * orders, so that legacy stock is written off through the ledger (an adjustment per level) before
 * the orders are received. Does nothing on a fresh database.
 */
async function retireLegacyOpeningStock(db: PrismaClient): Promise<number> {
  const legacy = await db.stockMovement.findMany({
    where: { referenceType: 'seed', referenceId: 'initial-stock' },
    select: { variantId: true, locationId: true },
  });
  if (legacy.length === 0) return 0;
  let retired = 0;
  await db.$transaction(
    async (tx) => {
      for (const { variantId, locationId } of legacy) {
        const done = await tx.stockMovement.count({
          where: { variantId, referenceType: 'seed', referenceId: 'initial-stock-retired' },
        });
        if (done > 0) continue;
        const level = await tx.inventoryLevel.findUnique({
          where: { variantId_locationId: { variantId, locationId } },
        });
        if (!level || level.onHand === 0) continue;
        await tx.inventoryLevel.update({
          where: { variantId_locationId: { variantId, locationId } },
          data: { onHand: 0, reserved: 0 },
        });
        await tx.stockMovement.create({
          data: {
            id: newId(),
            variantId,
            locationId,
            type: 'adjustment',
            quantity: -level.onHand,
            referenceType: 'seed',
            referenceId: 'initial-stock-retired',
            reason: 'Development seed: earlier opening stock replaced by purchase orders',
          },
        });
        retired += level.onHand;
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return retired;
}

export async function seedPurchasing(db: PrismaClient): Promise<PurchasingSeedResult> {
  const owner = await db.staffMember.findFirst({
    where: { role: 'owner', active: true },
    select: { userId: true },
  });
  if (!owner) throw new Error('Seed the owner before the purchasing history.');
  const variants = await db.productVariant.findMany({ select: { id: true, sku: true } });
  if (variants.length === 0) {
    return { skipped: true, orders: 0, receivedUnits: 0, retiredLegacyUnits: 0 };
  }
  // Imported late: these modules need the database client and the server-only stub of the CLI.
  const purchasing = await import('../src/modules/purchasing/service');
  const retiredLegacyUnits = await retireLegacyOpeningStock(db);

  const idBySku = new Map(variants.map((variant) => [variant.sku, variant.id]));
  const plan = buildCatalogSeed(newId).stockPlan.flatMap((line) => {
    const variantId = idBySku.get(line.sku);
    return variantId ? [{ ...line, variantId }] : [];
  });
  const actor = { userId: owner.userId };

  const supplier =
    (await db.supplier.findFirst({ where: { name: SUPPLIER_NAME } })) ??
    (await db.supplier.create({
      data: {
        id: newId(),
        name: SUPPLIER_NAME,
        contactName: 'Nasrin Akter',
        phone: '+880 1711 000000',
        email: 'orders@rupayan-garments.example',
        address: 'Plot 14, Tejgaon Industrial Area, Dhaka 1208',
        paymentTerms: '30 days after delivery',
        notes: 'Development seed supplier.',
      },
    }));

  const minor = (value: bigint) => {
    const text = value.toString().padStart(3, '0');
    return `${text.slice(0, -2)}.${text.slice(-2)}`;
  };
  const lineOf = (entry: (typeof plan)[number], quantity = entry.quantity) => ({
    variantId: entry.variantId,
    quantityOrdered: quantity,
    unitCost: minor(entry.supplierUnitCostMinor),
  });

  const stocked = plan.filter((entry) => entry.quantity > 0);
  const soldOut = plan.filter((entry) => entry.quantity === 0);
  const firstHalf = stocked.filter((entry) => entry.productIndex < 20);
  const secondHalf = stocked.filter((entry) => entry.productIndex >= 20);

  let orders = 0;
  let receivedUnits = 0;

  /** Creates the order unless its marker already exists (a rerun finds it and moves on). */
  async function raise(
    marker: string,
    lines: Array<ReturnType<typeof lineOf>>,
    costs: Array<{
      type: 'freight' | 'customs_duty' | 'inbound_transport';
      amount: string;
      method: 'by_quantity' | 'by_value';
    }>,
    expectedDays: number,
  ) {
    const existing = await db.purchaseOrder.findFirst({ where: { notes: marker } });
    if (existing) return { id: existing.id, status: existing.status as string };
    const expectedAt = new Date(Date.now() + expectedDays * 86_400_000).toISOString().slice(0, 10);
    const created = await purchasing.createPurchaseOrder(
      { supplierId: supplier.id, expectedAt, notes: marker, lines },
      actor,
    );
    for (const cost of costs) {
      await purchasing.addLandedCost({ poId: created.data.id, ...cost }, actor);
    }
    orders += 1;
    return { id: created.data.id, status: 'draft' };
  }

  /**
   * Places the order if it is still a draft and receives whatever is outstanding: two deliveries on
   * a fresh order (most of it first, the balance later), or just the balance of an order an earlier
   * run left half done. Fixed idempotency keys make every step safe to repeat.
   */
  async function receiveAll(poId: string, key: string) {
    const before = await db.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    if (before.status === 'draft') await purchasing.placeOrder(poId, actor);
    const items = await db.purchaseOrderItem.findMany({ where: { poId } });
    const fresh = items.every((item) => item.quantityReceived === 0);
    if (fresh) {
      const firstDelivery = items.map((item) => ({
        poItemId: item.id,
        quantity: Math.max(1, Math.ceil(item.quantityOrdered * 0.7)),
      }));
      await purchasing.receiveGoods(
        { poId, idempotencyKey: `${key}-1`, notes: 'First delivery', lines: firstDelivery },
        actor,
      );
    }
    const current = await db.purchaseOrderItem.findMany({ where: { poId } });
    const rest = current
      .map((item) => ({
        poItemId: item.id,
        quantity: item.quantityOrdered - item.quantityReceived,
      }))
      .filter((line) => line.quantity > 0);
    if (rest.length > 0) {
      await purchasing.receiveGoods(
        { poId, idempotencyKey: `${key}-2`, notes: 'Balance of the order', lines: rest },
        actor,
      );
    }
    receivedUnits += items.reduce((sum, item) => sum + item.quantityOrdered, 0);
  }

  const tops = await raise(
    MARKERS.tops,
    firstHalf.map((entry) => lineOf(entry)),
    [
      { type: 'freight', amount: '48000', method: 'by_value' },
      { type: 'customs_duty', amount: '36000', method: 'by_quantity' },
    ],
    -12,
  );
  if (tops.status !== 'received') await receiveAll(tops.id, 'seed-tops');

  const bottoms = await raise(
    MARKERS.bottoms,
    secondHalf.map((entry) => lineOf(entry)),
    [
      { type: 'freight', amount: '42000', method: 'by_value' },
      { type: 'inbound_transport', amount: '9000', method: 'by_quantity' },
    ],
    -9,
  );
  if (bottoms.status !== 'received') await receiveAll(bottoms.id, 'seed-bottoms');

  // Sold-out variants: a restock is on its way (placed, nothing received) and a draft is queued.
  const restock = soldOut.slice(0, Math.ceil(soldOut.length / 2));
  const queued = soldOut.slice(Math.ceil(soldOut.length / 2));
  if (restock.length > 0) {
    const onTheWay = await raise(
      MARKERS.onTheWay,
      restock.map((entry) => lineOf(entry, 24)),
      [{ type: 'freight', amount: '18000', method: 'by_quantity' }],
      6,
    );
    if (onTheWay.status === 'draft') await purchasing.placeOrder(onTheWay.id, actor);
  }
  if (queued.length > 0) {
    await raise(
      MARKERS.draft,
      queued.map((entry) => lineOf(entry, 18)),
      [],
      21,
    );
  }

  return { skipped: orders === 0, orders, receivedUnits, retiredLegacyUnits };
}
