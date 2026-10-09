import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { DomainError, isDomainError } from '@/lib/errors';
import {
  adjustStock,
  commitReservation,
  findLedgerMismatches,
  getAvailability,
  receive,
  releaseExpired,
  releaseReservation,
  reserve,
  sell,
  countVariantsWithoutCost,
  previewProductCost,
  setCostBasis,
} from '@/modules/inventory/service';
import { makeStaff } from '../factories';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(closeDatabase);

async function setup(onHand = 0, avgCostMinor = 40000n) {
  const product = await db.product.create({ data: { slug: 'stock-shirt', title: 'Stock shirt' } });
  const variant = await db.productVariant.create({
    data: { productId: product.id, sku: 'STK-1', priceMinor: 100000n, avgCostMinor },
  });
  const location = await db.location.create({ data: { name: 'Main', isDefault: true } });
  if (onHand > 0) {
    await db.$transaction((tx) =>
      receive(tx, {
        variantId: variant.id,
        quantity: onHand,
        unitCostMinor: avgCostMinor,
        referenceType: 'test',
        referenceId: 'seed',
      }),
    );
  }
  return { product, variant, location };
}

const level = (variantId: string) => db.inventoryLevel.findFirstOrThrow({ where: { variantId } });

const actor = async () => {
  const { user } = await makeStaff({ role: 'manager' });
  return { userId: user.id, requireSetCostStepUp: async () => {} };
};

async function errorCode(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    return isDomainError(error) ? error.code : `unexpected: ${String(error)}`;
  }
  return 'no error';
}

describe('stock levels and the ledger (INV-S1, INV-S3, INV-S4)', () => {
  it('a variant with no stock row has zero availability', async () => {
    const { variant } = await setup();
    const result = await getAvailability([variant.id]);
    expect(result.get(variant.id)).toMatchObject({ onHand: 0, reserved: 0, available: 0 });
  });

  it('a receipt creates the level and one movement, and the ledger reconciles', async () => {
    const { variant } = await setup(12);
    expect(await level(variant.id)).toMatchObject({ onHand: 12, reserved: 0 });
    const movements = await db.stockMovement.findMany({ where: { variantId: variant.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'receipt', quantity: 12, unitCostMinor: 40000n });
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('the app role cannot change or delete ledger rows (triggers)', async () => {
    const { variant } = await setup(5);
    const row = await db.stockMovement.findFirstOrThrow({ where: { variantId: variant.id } });
    await expect(
      db.stockMovement.update({ where: { id: row.id }, data: { quantity: 99 } }),
    ).rejects.toThrow(/append-only/);
  });
});

describe('manual adjustments', () => {
  const change = (delta: number) => ({ mode: 'delta' as const, delta });

  it('adds and removes stock with a reason, a movement and an audit row', async () => {
    const { variant } = await setup(10);
    const staff = await actor();
    const added = await adjustStock(
      { variantId: variant.id, reason: 'found', change: change(4) },
      staff,
    );
    expect(added.data).toMatchObject({ onHand: 14, delta: 4 });
    const removed = await adjustStock(
      { variantId: variant.id, reason: 'count_correction', change: change(-3) },
      staff,
    );
    expect(removed.data).toMatchObject({ onHand: 11, delta: -3 });
    expect(removed.tags).toEqual(expect.arrayContaining([`stock:${variant.id}`, 'stock']));

    const movements = await db.stockMovement.findMany({
      where: { variantId: variant.id, type: 'adjustment' },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements.map((m) => m.quantity)).toEqual([4, -3]);
    expect(movements[0]?.actorId).toBe(staff.userId);
    const audits = await db.auditLog.findMany({ where: { action: 'stock.adjust' } });
    expect(audits).toHaveLength(2);
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('an absolute count sets the quantity on hand', async () => {
    const { variant } = await setup(10);
    const result = await adjustStock(
      { variantId: variant.id, reason: 'count_correction', change: { mode: 'set', counted: 7 } },
      await actor(),
    );
    expect(result.data).toMatchObject({ onHand: 7, delta: -3 });
  });

  it('a write-off is a write_off movement and must remove units', async () => {
    const { variant } = await setup(10, 100n);
    const staff = await actor();
    await adjustStock({ variantId: variant.id, reason: 'damaged', change: change(-2) }, staff);
    const row = await db.stockMovement.findFirstOrThrow({
      where: { variantId: variant.id, type: 'write_off' },
    });
    expect(row.quantity).toBe(-2);
    expect(
      await errorCode(
        adjustStock(
          { variantId: variant.id, reason: 'write_off', note: 'x', change: change(2) },
          staff,
        ),
      ),
    ).toBe('VALIDATION');
    expect(
      await errorCode(
        adjustStock({ variantId: variant.id, reason: 'found', change: change(-1) }, staff),
      ),
    ).toBe('VALIDATION');
  });

  it('refuses to remove stock that is reserved for customers', async () => {
    const { variant } = await setup(10);
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'checkout',
        referenceId: 'c1',
        lines: [{ variantId: variant.id, quantity: 8 }],
      }),
    );
    const code = await errorCode(
      adjustStock(
        { variantId: variant.id, reason: 'count_correction', change: change(-5) },
        await actor(),
      ),
    );
    expect(code).toBe('CONFLICT');
    expect(await level(variant.id)).toMatchObject({ onHand: 10, reserved: 8 });
  });

  it('a large write-down needs a second approver (maker-checker)', async () => {
    // 30 units at 400.00 = 12,000.00 BDT, above the default 10,000.00 threshold.
    const { variant } = await setup(40, 40000n);
    const code = await errorCode(
      adjustStock(
        { variantId: variant.id, reason: 'count_correction', change: change(-30) },
        await actor(),
      ),
    );
    expect(code).toBe('APPROVAL_REQUIRED');
    expect(await level(variant.id)).toMatchObject({ onHand: 40 });
  });
});

describe('cost basis from manual additions (INV-F3, INV-S3)', () => {
  const add = (
    variantId: string,
    delta: number,
    unitCost?: string,
    reason: 'opening_stock' | 'found' = 'opening_stock',
  ) => ({
    variantId,
    reason,
    change: { mode: 'delta' as const, delta },
    ...(unitCost ? { unitCost } : {}),
  });
  const avg = async (variantId: string) =>
    (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).avgCostMinor;

  it('refuses to add stock to a variant with no cost unless a unit cost is given', async () => {
    const { variant } = await setup(0, 0n);
    const staff = await actor();
    expect(await errorCode(adjustStock(add(variant.id, 5), staff))).toBe('VALIDATION');
    expect(await db.stockMovement.count({ where: { variantId: variant.id } })).toBe(0);
    expect(await db.inventoryLevel.count({ where: { variantId: variant.id } })).toBe(0);
  });

  it('first addition sets the cost, a later one at another cost blends it, one ledger row each', async () => {
    const { variant } = await setup(0, 0n);
    const staff = await actor();
    await adjustStock(add(variant.id, 5, '1000'), staff);
    expect(await avg(variant.id)).toBe(100000n);
    // Optional once a cost exists: no cost given leaves the average alone.
    await adjustStock(add(variant.id, 2, undefined, 'found'), staff);
    expect(await avg(variant.id)).toBe(100000n);
    // 7 on hand at 1,000.00, 3 more at 1,300.00: (7 x 1000 + 3 x 1300) / 10 = 1,090.00.
    await adjustStock(add(variant.id, 3, '1300'), staff);
    expect(await avg(variant.id)).toBe(109000n);

    const rows = await db.stockMovement.findMany({
      where: { variantId: variant.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => [r.type, r.quantity, r.unitCostMinor])).toEqual([
      ['adjustment', 5, 100000n],
      ['adjustment', 2, null],
      ['adjustment', 3, 130000n],
    ]);
    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: 'stock.adjust', entityId: variant.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.after).toMatchObject({ avgCostMinor: '100000', unitCostMinor: '100000' });
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('the cost base counts units on hand in every location, reserved ones included', async () => {
    const { variant } = await setup(4, 100000n);
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'checkout',
        referenceId: 'c-cost',
        lines: [{ variantId: variant.id, quantity: 2 }],
      }),
    );
    await adjustStock(add(variant.id, 4, '1200'), await actor());
    // (4 x 1000 + 4 x 1200) / 8 = 1,100.00
    expect(await avg(variant.id)).toBe(110000n);
  });

  it('a variant that holds uncosted stock takes the typed cost as the basis for all units', async () => {
    const { variant } = await setup(0, 0n);
    await db.$transaction((tx) =>
      receive(tx, {
        variantId: variant.id,
        quantity: 6,
        unitCostMinor: 0n,
        referenceType: 'test',
        referenceId: 'uncosted',
      }),
    );
    await adjustStock(add(variant.id, 4, '500'), await actor());
    expect(await avg(variant.id)).toBe(50000n);
  });

  it('removals never change the cost and refuse a unit cost', async () => {
    const { variant } = await setup(10, 100000n);
    const staff = await actor();
    await adjustStock(
      { variantId: variant.id, reason: 'count_correction', change: { mode: 'delta', delta: -2 } },
      staff,
    );
    expect(await avg(variant.id)).toBe(100000n);
    expect(
      await errorCode(
        adjustStock(
          {
            variantId: variant.id,
            reason: 'count_correction',
            change: { mode: 'delta', delta: -1 },
            unitCost: '5',
          },
          staff,
        ),
      ),
    ).toBe('VALIDATION');
  });

  it('opening stock must add units', async () => {
    const { variant } = await setup(5, 100000n);
    expect(
      await errorCode(
        adjustStock(
          { variantId: variant.id, reason: 'opening_stock', change: { mode: 'delta', delta: -1 } },
          await actor(),
        ),
      ),
    ).toBe('VALIDATION');
  });

  it('a big opening stock needs a second approver by its typed cost value', async () => {
    const { variant } = await setup(0, 0n);
    // 100 units at 500.00 = 50,000.00, above the 10,000.00 default threshold.
    expect(await errorCode(adjustStock(add(variant.id, 100, '500'), await actor()))).toBe(
      'APPROVAL_REQUIRED',
    );
    expect(await avg(variant.id)).toBe(0n);
    expect(await db.stockMovement.count({ where: { variantId: variant.id } })).toBe(0);
  });
});

describe('setting a cost through Adjust stock needs the Set cost step-up (INV-A6)', () => {
  const addWithCost = (variantId: string, delta: number, unitCost: string) => ({
    variantId,
    reason: 'opening_stock' as const,
    change: { mode: 'delta' as const, delta },
    unitCost,
  });

  it('refuses a cost that would set the basis when the step-up is missing or fails', async () => {
    const { variant } = await setup(0, 0n);
    const { user } = await makeStaff({ role: 'manager' });
    // No way to ask for the step-up: refused.
    expect(
      await errorCode(adjustStock(addWithCost(variant.id, 5, '1000'), { userId: user.id })),
    ).toBe('FORBIDDEN');
    // The step-up itself fails: its error comes out and nothing changed.
    const failing = {
      userId: user.id,
      requireSetCostStepUp: async () => {
        throw new DomainError('STEP_UP_REQUIRED');
      },
    };
    expect(await errorCode(adjustStock(addWithCost(variant.id, 5, '1000'), failing))).toBe(
      'STEP_UP_REQUIRED',
    );
    expect(await db.stockMovement.count({ where: { variantId: variant.id } })).toBe(0);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).avgCostMinor,
    ).toBe(0n);
  });

  it('also asks when the variant has a cost but nothing on hand, and not for a plain blend', async () => {
    const { variant } = await setup(0, 40000n);
    const { user } = await makeStaff({ role: 'manager' });
    const asked = vi.fn(async () => {});
    const actorWith = { userId: user.id, requireSetCostStepUp: asked };
    await adjustStock(addWithCost(variant.id, 2, '1000'), actorWith);
    expect(asked).toHaveBeenCalledTimes(1);
    // Units are on hand now, so a further typed cost is a normal blend: no extra step-up.
    await adjustStock(addWithCost(variant.id, 2, '1200'), actorWith);
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('counts the units already on hand when giving them a cost (maker-checker valuation)', async () => {
    const { variant } = await setup(0, 0n);
    // 3,000 units on hand without a cost (found before costs existed).
    await db.inventoryLevel.create({
      data: {
        variantId: variant.id,
        locationId: (await db.location.findFirstOrThrow()).id,
        onHand: 3000,
        reserved: 0,
      },
    });
    // Typing 1 unit at BDT 1,000 re-values 3,001 units: far above the approval threshold.
    expect(await errorCode(adjustStock(addWithCost(variant.id, 1, '1000'), await actor()))).toBe(
      'APPROVAL_REQUIRED',
    );
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).avgCostMinor,
    ).toBe(0n);
  });

  it('Set cost is also gated by approval when the stock on hand is worth a lot', async () => {
    const { variant } = await setup(0, 0n);
    await db.inventoryLevel.create({
      data: {
        variantId: variant.id,
        locationId: (await db.location.findFirstOrThrow()).id,
        onHand: 3000,
        reserved: 0,
      },
    });
    expect(
      await errorCode(
        setCostBasis(
          { scope: { kind: 'variant', variantId: variant.id }, unitCost: '1000' },
          await actor(),
        ),
      ),
    ).toBe('APPROVAL_REQUIRED');
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).avgCostMinor,
    ).toBe(0n);
  });
});

describe('set cost basis (INV-A2, INV-F3)', () => {
  const makeVariants = async () => {
    const product = await db.product.create({
      data: { slug: 'cost-shirt', title: 'Cost shirt', status: 'active' },
    });
    const mk = (sku: string, avgCostMinor: bigint, position: number) =>
      db.productVariant.create({
        data: {
          productId: product.id,
          sku,
          priceMinor: 100000n,
          avgCostMinor,
          position,
          status: 'active',
        },
      });
    const a = await mk('CS-S', 0n, 0);
    const b = await mk('CS-M', 0n, 1);
    const c = await mk('CS-L', 75000n, 2);
    await db.location.create({ data: { name: 'Main', isDefault: true } });
    return { product, a, b, c };
  };
  const avg = async (id: string) =>
    (await db.productVariant.findUniqueOrThrow({ where: { id } })).avgCostMinor;

  it('sets the cost of one variant that has none, with an audit row and tags', async () => {
    const { a, product } = await makeVariants();
    const staff = await actor();
    const result = await setCostBasis(
      { scope: { kind: 'variant', variantId: a.id }, unitCost: '1250.50' },
      staff,
    );
    expect(result).toMatchObject({ updated: 1, skipped: 0 });
    expect(result.tags).toEqual(
      expect.arrayContaining([`stock:${a.id}`, `product:${product.id}`, 'products']),
    );
    expect(await avg(a.id)).toBe(125050n);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'stock.set_cost' } });
    expect(audit).toMatchObject({ entityId: a.id, actorId: staff.userId });
    expect(audit.before).toMatchObject({ avgCostMinor: '0' });
    expect(audit.after).toMatchObject({ avgCostMinor: '125050' });
  });

  it('refuses a variant that already has a cost and leaves it untouched', async () => {
    const { c } = await makeVariants();
    expect(
      await errorCode(
        setCostBasis({ scope: { kind: 'variant', variantId: c.id }, unitCost: '1' }, await actor()),
      ),
    ).toBe('CONFLICT');
    expect(await avg(c.id)).toBe(75000n);
    expect(await db.auditLog.count({ where: { action: 'stock.set_cost' } })).toBe(0);
  });

  it('sets the same cost on every variant of a product that lacks one and skips the rest', async () => {
    const { product, a, b, c } = await makeVariants();
    const preview = await previewProductCost(product.id);
    expect(preview.map((row) => [row.sku, row.hasCost])).toEqual([
      ['CS-S', false],
      ['CS-M', false],
      ['CS-L', true],
    ]);
    const result = await setCostBasis(
      { scope: { kind: 'product', productId: product.id }, unitCost: '900' },
      await actor(),
    );
    expect(result).toMatchObject({ updated: 2, skipped: 1 });
    expect([await avg(a.id), await avg(b.id), await avg(c.id)]).toEqual([90000n, 90000n, 75000n]);
    expect(await countVariantsWithoutCost()).toBe(0);
    expect(
      await errorCode(
        setCostBasis(
          { scope: { kind: 'product', productId: product.id }, unitCost: '1' },
          await actor(),
        ),
      ),
    ).toBe('CONFLICT');
  });

  it('counts only live variants without cost', async () => {
    const { a } = await makeVariants();
    expect(await countVariantsWithoutCost()).toBe(2);
    await db.productVariant.update({ where: { id: a.id }, data: { status: 'archived' } });
    expect(await countVariantsWithoutCost()).toBe(1);
  });
});

describe('reserve, commit and release (INV-S2, INV-S3, INV-S5)', () => {
  it('reserves, then commits into a sale, and reconciles', async () => {
    const { variant } = await setup(10);
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'checkout',
        referenceId: 'c1',
        lines: [{ variantId: variant.id, quantity: 3 }],
      }),
    );
    expect(await level(variant.id)).toMatchObject({ onHand: 10, reserved: 3 });
    expect((await getAvailability([variant.id])).get(variant.id)?.available).toBe(7);

    await db.$transaction((tx) =>
      commitReservation(tx, {
        referenceType: 'checkout',
        referenceId: 'c1',
        lines: [{ variantId: variant.id, quantity: 3 }],
      }),
    );
    expect(await level(variant.id)).toMatchObject({ onHand: 7, reserved: 0 });
    // Repeating the commit does nothing (idempotent).
    await db.$transaction((tx) =>
      commitReservation(tx, {
        referenceType: 'checkout',
        referenceId: 'c1',
        lines: [{ variantId: variant.id, quantity: 3 }],
      }),
    );
    expect(await level(variant.id)).toMatchObject({ onHand: 7, reserved: 0 });
    expect(await findLedgerMismatches()).toEqual([]);
    const sales = await db.stockMovement.count({ where: { type: 'sale' } });
    expect(sales).toBe(1);
  });

  it('release returns exactly what was held, and twice is a no-op', async () => {
    const { variant } = await setup(10);
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'order',
        referenceId: 'o1',
        lines: [{ variantId: variant.id, quantity: 4 }],
      }),
    );
    await db.$transaction((tx) =>
      releaseReservation(tx, { referenceType: 'order', referenceId: 'o1' }),
    );
    await db.$transaction((tx) =>
      releaseReservation(tx, { referenceType: 'order', referenceId: 'o1' }),
    );
    expect(await level(variant.id)).toMatchObject({ onHand: 10, reserved: 0 });
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('reserving twice for the same reference holds the stock once', async () => {
    const { variant } = await setup(10);
    const input = {
      referenceType: 'checkout',
      referenceId: 'dup',
      lines: [{ variantId: variant.id, quantity: 2 }],
    };
    await db.$transaction((tx) => reserve(tx, input));
    await db.$transaction((tx) => reserve(tx, input));
    expect(await level(variant.id)).toMatchObject({ reserved: 2 });
  });

  it('a short line fails the whole reservation and holds nothing', async () => {
    const a = await setup(5);
    const other = await db.productVariant.create({
      data: { productId: a.product.id, sku: 'STK-2', priceMinor: 1000n },
    });
    await db.$transaction((tx) =>
      receive(tx, {
        variantId: other.id,
        quantity: 1,
        unitCostMinor: 1n,
        referenceType: 'test',
        referenceId: 'seed',
      }),
    );
    const code = await errorCode(
      db.$transaction((tx) =>
        reserve(tx, {
          referenceType: 'checkout',
          referenceId: 'multi',
          lines: [
            { variantId: a.variant.id, quantity: 2 },
            { variantId: other.id, quantity: 2 },
          ],
        }),
      ),
    );
    expect(code).toBe('OUT_OF_STOCK');
    expect(await level(a.variant.id)).toMatchObject({ reserved: 0 });
    expect(await db.stockReservation.count()).toBe(0);
  });

  it('a direct sale takes free stock only', async () => {
    const { variant } = await setup(5);
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'checkout',
        referenceId: 'hold',
        lines: [{ variantId: variant.id, quantity: 3 }],
      }),
    );
    const code = await errorCode(
      db.$transaction((tx) =>
        sell(tx, {
          referenceType: 'order',
          referenceId: 'cod',
          lines: [{ variantId: variant.id, quantity: 3 }],
        }),
      ),
    );
    expect(code).toBe('OUT_OF_STOCK');
    await db.$transaction((tx) =>
      sell(tx, {
        referenceType: 'order',
        referenceId: 'cod',
        lines: [{ variantId: variant.id, quantity: 2 }],
      }),
    );
    expect(await level(variant.id)).toMatchObject({ onHand: 3, reserved: 3 });
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('committing a hold that expired and was released fails instead of selling unheld stock (INV-S2)', async () => {
    const { variant } = await setup(10);
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'checkout',
        referenceId: 'late',
        lines: [{ variantId: variant.id, quantity: 4 }],
      }),
    );
    await db.$executeRaw`UPDATE stock_reservations SET expires_at = now() - interval '1 minute' WHERE reference_id = 'late'`;
    await releaseExpired();
    const code = await errorCode(
      db.$transaction((tx) =>
        commitReservation(tx, {
          referenceType: 'checkout',
          referenceId: 'late',
          lines: [{ variantId: variant.id, quantity: 4 }],
        }),
      ),
    );
    expect(code).toBe('CONFLICT');
    expect(await level(variant.id)).toMatchObject({ onHand: 10, reserved: 0 });
  });

  it('a hold that belongs to an order is never released by the timer (INV-O2, INV-O11)', async () => {
    const { variant } = await setup(10);
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'order',
        referenceId: 'awaiting-verification',
        lines: [{ variantId: variant.id, quantity: 5 }],
      }),
    );
    await db.$executeRaw`UPDATE stock_reservations SET expires_at = now() - interval '1 day'`;
    expect((await releaseExpired()).released).toBe(0);
    expect(await level(variant.id)).toMatchObject({ reserved: 5 });
  });

  it('the application role may run the expiry function (it is granted explicitly)', async () => {
    const rows = await db.$queryRaw<
      Array<{ ok: boolean }>
    >`SELECT has_function_privilege('auren_app', 'release_expired_reservations(integer)', 'EXECUTE') AS ok`;
    expect(rows[0]?.ok).toBe(true);
  });

  it('reserve, receive and the expiry job run together without deadlock or drift', async () => {
    const a = await setup(40);
    const b = await db.productVariant.create({
      data: { productId: a.product.id, sku: 'STK-B', priceMinor: 1000n },
    });
    await db.$transaction((tx) =>
      receive(tx, {
        variantId: b.id,
        quantity: 40,
        unitCostMinor: 1n,
        referenceType: 'test',
        referenceId: 'seed-b',
      }),
    );
    const lines = (i: number) =>
      i % 2 === 0
        ? [
            { variantId: a.variant.id, quantity: 1 },
            { variantId: b.id, quantity: 1 },
          ]
        : [
            { variantId: b.id, quantity: 1 },
            { variantId: a.variant.id, quantity: 1 },
          ];
    const work: Array<Promise<unknown>> = [];
    for (let i = 0; i < 24; i += 1) {
      work.push(
        db.$transaction((tx) =>
          reserve(tx, { referenceType: 'checkout', referenceId: `mix-${i}`, lines: lines(i) }),
        ),
      );
    }
    for (let i = 0; i < 4; i += 1) work.push(releaseExpired());
    for (let i = 0; i < 4; i += 1) {
      work.push(
        db.$transaction((tx) =>
          receive(tx, {
            variantId: i % 2 === 0 ? a.variant.id : b.id,
            quantity: 2,
            unitCostMinor: 1n,
            referenceType: 'test',
            referenceId: `mix-receipt-${i}`,
          }),
        ),
      );
    }
    await Promise.all(work);
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('releases expired reservations, idempotently, and leaves orders alone (INV-O2)', async () => {
    const { variant } = await setup(10);
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'checkout',
        referenceId: 'old',
        lines: [{ variantId: variant.id, quantity: 4 }],
        ttlSeconds: 60,
      }),
    );
    await db.$transaction((tx) =>
      reserve(tx, {
        referenceType: 'checkout',
        referenceId: 'fresh',
        lines: [{ variantId: variant.id, quantity: 2 }],
      }),
    );
    await db.$executeRaw`UPDATE stock_reservations SET expires_at = now() - interval '1 minute' WHERE reference_id = 'old'`;

    const first = await releaseExpired();
    expect(first.released).toBe(1);
    expect(first.tags).toContain(`stock:${variant.id}`);
    expect(await level(variant.id)).toMatchObject({ onHand: 10, reserved: 2 });
    const second = await releaseExpired();
    expect(second.released).toBe(0);
    const old = await db.stockReservation.findFirstOrThrow({ where: { referenceId: 'old' } });
    expect(old.status).toBe('released');
    expect(await findLedgerMismatches()).toEqual([]);
  });
});

describe('no overselling under concurrency (INV-S2)', () => {
  it('50 parallel buys of 1 unit against 10 in stock: exactly 10 succeed', async () => {
    const { variant } = await setup(10);
    const attempts = Array.from({ length: 50 }, (_, i) =>
      db
        .$transaction((tx) =>
          reserve(tx, {
            referenceType: 'checkout',
            referenceId: `buyer-${i}`,
            lines: [{ variantId: variant.id, quantity: 1 }],
          }),
        )
        .then(() => 'ok' as const)
        .catch((error: unknown) => (isDomainError(error) ? error.code : String(error))),
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r === 'ok')).toHaveLength(10);
    expect(results.filter((r) => r === 'OUT_OF_STOCK')).toHaveLength(40);
    expect(await level(variant.id)).toMatchObject({ onHand: 10, reserved: 10 });
    expect(await db.stockReservation.count()).toBe(10);
    expect(await findLedgerMismatches()).toEqual([]);
  });

  it('50 parallel buys of 10 units against 10 in stock: exactly 1 succeeds', async () => {
    const { variant } = await setup(10);
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        db
          .$transaction((tx) =>
            sell(tx, {
              referenceType: 'order',
              referenceId: `cod-${i}`,
              lines: [{ variantId: variant.id, quantity: 10 }],
            }),
          )
          .then(() => 'ok' as const)
          .catch((error: unknown) => (isDomainError(error) ? error.code : String(error))),
      ),
    );
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r === 'OUT_OF_STOCK')).toHaveLength(49);
    expect(await level(variant.id)).toMatchObject({ onHand: 0, reserved: 0 });
    expect(await findLedgerMismatches()).toEqual([]);
  });
});
