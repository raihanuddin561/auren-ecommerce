import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { isDomainError } from '@/lib/errors';
import { deserialize, format } from '@/lib/money';
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from '@/modules/cart/schemas';
import {
  actorKey,
  addLine,
  clearCart,
  getView,
  loadForCheckout,
  purgeExpired,
  setLineQuantity,
  type CartIdentity,
} from '@/modules/cart/service';
import { hashCartToken } from '@/modules/cart/token';
import { makeCustomer } from '../factories';
import { makeSellableVariant, seedDelivery } from './commerce-helpers';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  await seedDelivery();
});
afterAll(closeDatabase);

const guest = (token: string | null): CartIdentity => ({ userId: null, token });

async function errorCode(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    return isDomainError(error) ? error.code : `unexpected: ${String(error)}`;
  }
  return 'no error';
}

describe('guest bag (4.1)', () => {
  it('creates a bag on first add and stores only the hash of the cookie token', async () => {
    const { variantId } = await makeSellableVariant({ stock: 5 });
    const result = await addLine(guest(null), { variantId, quantity: 2 });
    expect(result.newToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.view.count).toBe(2);
    const carts = await db.cart.findMany();
    expect(carts).toHaveLength(1);
    expect(carts[0]!.tokenHash).toBe(hashCartToken(result.newToken!));
    expect(carts[0]!.tokenHash).not.toBe(result.newToken);
    expect(carts[0]!.userId).toBeNull();
  });

  it('adds to an existing line and reads the same bag back with the cookie', async () => {
    const { variantId } = await makeSellableVariant({ stock: 9 });
    const first = await addLine(guest(null), { variantId, quantity: 1 });
    const second = await addLine(guest(first.newToken), { variantId, quantity: 3 });
    expect(second.newToken).toBeNull();
    expect(second.view.lines).toHaveLength(1);
    expect(second.view.lines[0]!.quantity).toBe(4);
    expect((await getView(guest(first.newToken))).count).toBe(4);
  });

  it('a stranger or malformed cookie sees an empty bag', async () => {
    const { variantId } = await makeSellableVariant({ stock: 3 });
    await addLine(guest(null), { variantId, quantity: 1 });
    expect((await getView(guest('x'.repeat(43)))).count).toBe(0);
    expect(await getView(guest('not-a-token'))).toMatchObject({ count: 0 });
    expect((await getView(guest(null))).lines).toEqual([]);
  });

  it('totals come from database prices, never from the request (INV-M3)', async () => {
    const { variantId } = await makeSellableVariant({ stock: 9, priceMinor: 120000n });
    const first = await addLine(guest(null), { variantId, quantity: 2 });
    expect(deserialize(first.view.subtotal).minor).toBe(240000n);
    await db.productVariant.update({ where: { id: variantId }, data: { priceMinor: 150000n } });
    const view = await getView(guest(first.newToken));
    expect(deserialize(view.subtotal).minor).toBe(300000n);
    expect(format(deserialize(view.lines[0]!.unitPrice), { trimZeroFraction: true })).toContain(
      '1,500',
    );
  });

  it('refuses more than the stock, a sold-out size and unpublished products', async () => {
    const some = await makeSellableVariant({ stock: 2 });
    const none = await makeSellableVariant({ stock: 0 });
    const draft = await makeSellableVariant({ stock: 5, published: false });
    expect(await errorCode(addLine(guest(null), { variantId: some.variantId, quantity: 3 }))).toBe(
      'OUT_OF_STOCK',
    );
    expect(await errorCode(addLine(guest(null), { variantId: none.variantId, quantity: 1 }))).toBe(
      'OUT_OF_STOCK',
    );
    expect(await errorCode(addLine(guest(null), { variantId: draft.variantId, quantity: 1 }))).toBe(
      'NOT_FOUND',
    );
    // A refused add must not leave an empty bag behind.
    expect(await db.cartItem.count()).toBe(0);
  });

  it('adding past the stock across two adds is refused too', async () => {
    const { variantId } = await makeSellableVariant({ stock: 3 });
    const first = await addLine(guest(null), { variantId, quantity: 2 });
    expect(await errorCode(addLine(guest(first.newToken), { variantId, quantity: 2 }))).toBe(
      'OUT_OF_STOCK',
    );
    expect((await getView(guest(first.newToken))).count).toBe(2);
  });

  it('caps the quantity of one line and the number of lines', async () => {
    const big = await makeSellableVariant({ stock: 100 });
    const first = await addLine(guest(null), {
      variantId: big.variantId,
      quantity: MAX_LINE_QUANTITY,
    });
    expect(
      await errorCode(addLine(guest(first.newToken), { variantId: big.variantId, quantity: 1 })),
    ).toBe('CONFLICT');

    for (let i = 1; i < MAX_CART_LINES; i += 1) {
      const v = await makeSellableVariant({ stock: 2 });
      await addLine(guest(first.newToken), { variantId: v.variantId, quantity: 1 });
    }
    const extra = await makeSellableVariant({ stock: 2 });
    expect(
      await errorCode(addLine(guest(first.newToken), { variantId: extra.variantId, quantity: 1 })),
    ).toBe('CONFLICT');
  });

  it('removes a line with quantity zero and restores it with the same call (undo)', async () => {
    const { variantId } = await makeSellableVariant({ stock: 9 });
    const first = await addLine(guest(null), { variantId, quantity: 3 });
    const removed = await setLineQuantity(guest(first.newToken), { variantId, quantity: 0 });
    expect(removed.view.count).toBe(0);
    const restored = await setLineQuantity(guest(first.newToken), { variantId, quantity: 3 });
    expect(restored.view.lines[0]!.quantity).toBe(3);
    const set = await setLineQuantity(guest(first.newToken), { variantId, quantity: 5 });
    expect(set.view.count).toBe(5);
    expect(
      await errorCode(setLineQuantity(guest(first.newToken), { variantId, quantity: 10 })),
    ).toBe('OUT_OF_STOCK');
  });

  it('flags a line whose stock fell below the quantity and leaves it out of the total', async () => {
    const { variantId } = await makeSellableVariant({ stock: 5, priceMinor: 100000n });
    const first = await addLine(guest(null), { variantId, quantity: 4 });
    await db.inventoryLevel.updateMany({ where: { variantId }, data: { onHand: 2 } });
    const view = await getView(guest(first.newToken));
    expect(view.lines[0]!.issue).toBe('short');
    expect(view.hasIssues).toBe(true);
    expect(deserialize(view.subtotal).minor).toBe(0n);
  });

  it('reports the free delivery progress from the shipping rates', async () => {
    const cheap = await makeSellableVariant({ stock: 9, priceMinor: 100000n });
    const first = await addLine(guest(null), { variantId: cheap.variantId, quantity: 1 });
    const progress = first.view.freeDelivery;
    expect(deserialize(progress.threshold!).minor).toBe(500000n);
    expect(deserialize(progress.remaining!).minor).toBe(400000n);
    expect(progress.reached).toBe(false);
    const more = await addLine(guest(first.newToken), { variantId: cheap.variantId, quantity: 4 });
    expect(more.view.freeDelivery).toMatchObject({ reached: true, remaining: null });
  });

  it('ignores an expired bag', async () => {
    const { variantId } = await makeSellableVariant({ stock: 3 });
    const first = await addLine(guest(null), { variantId, quantity: 1 });
    await db.cart.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await getView(guest(first.newToken))).count).toBe(0);
    expect(await purgeExpired()).toBe(1);
    expect(await db.cart.count()).toBe(0);
  });
});

describe('customer bag and merge on sign-in (4.1)', () => {
  it('adopts a guest bag when the customer has none', async () => {
    const { variantId } = await makeSellableVariant({ stock: 9 });
    const { user } = await makeCustomer();
    const first = await addLine(guest(null), { variantId, quantity: 2 });
    const view = await getView({ userId: user.id, token: first.newToken });
    expect(view.count).toBe(2);
    const carts = await db.cart.findMany();
    expect(carts).toHaveLength(1);
    expect(carts[0]).toMatchObject({ userId: user.id, tokenHash: null });
    // The guest cookie no longer finds a bag of its own.
    expect((await getView(guest(first.newToken))).count).toBe(0);
  });

  it('merges quantities into the customer bag, up to the line cap, and drops the guest bag', async () => {
    const a = await makeSellableVariant({ stock: 50 });
    const b = await makeSellableVariant({ stock: 50 });
    const { user } = await makeCustomer();
    await addLine({ userId: user.id, token: null }, { variantId: a.variantId, quantity: 7 });
    const g = await addLine(guest(null), { variantId: a.variantId, quantity: 6 });
    await addLine(guest(g.newToken), { variantId: b.variantId, quantity: 2 });

    const merged = await getView({ userId: user.id, token: g.newToken });
    const byVariant = new Map(merged.lines.map((l) => [l.variantId, l.quantity]));
    expect(byVariant.get(a.variantId)).toBe(MAX_LINE_QUANTITY);
    expect(byVariant.get(b.variantId)).toBe(2);
    expect(await db.cart.count()).toBe(1);
    // Reading again changes nothing.
    expect((await getView({ userId: user.id, token: g.newToken })).count).toBe(12);
  });
});

describe('checkout hand-over (4.1)', () => {
  it('locks and returns the lines, and clearing leaves an empty bag', async () => {
    const { variantId } = await makeSellableVariant({ stock: 9 });
    const first = await addLine(guest(null), { variantId, quantity: 2 });
    const identity = guest(first.newToken);
    const loaded = await db.$transaction((tx) => loadForCheckout(tx, identity));
    expect(loaded.lines).toEqual([{ variantId, quantity: 2 }]);
    expect(actorKey(identity)).toMatch(/^guest:[0-9a-f]{32}$/);
    await db.$transaction((tx) => clearCart(tx, loaded.cartId));
    expect(await errorCode(db.$transaction((tx) => loadForCheckout(tx, identity)))).toBe(
      'VALIDATION',
    );
  });
});
