import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import * as catalog from '@/modules/catalog/service';
import * as inventory from '@/modules/inventory/service';
import * as shipping from '@/modules/shipping/service';
import * as repo from './repository';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  type AddToCartInput,
  type SetLineQuantityInput,
} from './schemas';
import { CART_TTL_DAYS, hashCartToken, isCartToken, newCartToken } from './token';
import type { CartIdentity } from './types';
import { buildCartView, emptyCartView, type CartView } from './view';

export type { CartIdentity };

export const CART_CURRENCY = 'BDT';

export interface CartResult {
  view: CartView;
  /** A cookie must be set to this value: the bag was just created for a guest. */
  newToken: string | null;
}

type CartRow = NonNullable<Awaited<ReturnType<typeof repo.findById>>>;

const expiryFrom = (now: Date) => new Date(now.getTime() + CART_TTL_DAYS * 24 * 3600 * 1000);

// ---------------------------------------------------------------------------------------------
// Finding the bag (and merging a guest bag into the customer's)
// ---------------------------------------------------------------------------------------------

async function findGuestCart(tx: Tx, identity: CartIdentity, now: Date) {
  if (!isCartToken(identity.token)) return null;
  const cart = await repo.findByTokenHash(tx, hashCartToken(identity.token));
  return cart && cart.expiresAt > now && cart.userId === null ? cart : null;
}

/**
 * Moves the lines of a guest bag into the customer's bag and removes the guest bag. Quantities add
 * up to the per-line cap and extra lines beyond the line cap are dropped: a merge never fails.
 */
async function mergeInto(tx: Tx, target: CartRow, guest: CartRow, now: Date): Promise<CartRow> {
  await repo.lockCart(tx, target.id);
  const quantities = new Map(target.items.map((item) => [item.variantId, item.quantity]));
  for (const item of guest.items) {
    const existing = quantities.get(item.variantId);
    if (existing === undefined && quantities.size >= MAX_CART_LINES) continue;
    const next = Math.min(MAX_LINE_QUANTITY, (existing ?? 0) + item.quantity);
    quantities.set(item.variantId, next);
    await repo.upsertItem(tx, target.id, item.variantId, next);
  }
  await repo.deleteCart(tx, guest.id);
  await repo.touchCart(tx, target.id, expiryFrom(now));
  return (await repo.findById(tx, target.id))!;
}

/**
 * The visitor's bag, or null when there is none. For a signed-in customer a guest bag from this
 * browser is merged in (or adopted when the customer has no bag yet).
 */
async function findCart(tx: Tx, identity: CartIdentity, now: Date): Promise<CartRow | null> {
  const guest = await findGuestCart(tx, identity, now);
  if (!identity.userId) return guest;
  const mine = await repo.findByUserId(tx, identity.userId);
  const live = mine && mine.expiresAt > now ? mine : null;
  if (!guest) return live;
  if (!live) {
    // An expired customer bag is replaced by the guest bag the customer is holding now.
    if (mine) await repo.deleteCart(tx, mine.id);
    await repo.adoptCart(tx, guest.id, identity.userId, expiryFrom(now));
    return repo.findById(tx, guest.id);
  }
  return mergeInto(tx, live, guest, now);
}

async function findOrCreateCart(
  tx: Tx,
  identity: CartIdentity,
  now: Date,
): Promise<{ cart: CartRow; newToken: string | null }> {
  const existing = await findCart(tx, identity, now);
  if (existing) return { cart: existing, newToken: null };
  if (identity.userId) {
    const stale = await repo.findByUserId(tx, identity.userId);
    if (stale) await repo.deleteCart(tx, stale.id);
    const cart = await repo.createCart(tx, {
      tokenHash: null,
      userId: identity.userId,
      currency: CART_CURRENCY,
      expiresAt: expiryFrom(now),
    });
    return { cart, newToken: null };
  }
  const token = newCartToken();
  const cart = await repo.createCart(tx, {
    tokenHash: hashCartToken(token),
    userId: null,
    currency: CART_CURRENCY,
    expiresAt: expiryFrom(now),
  });
  return { cart, newToken: token };
}

// ---------------------------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------------------------

async function viewOf(cart: CartRow | null): Promise<CartView> {
  const threshold = await shipping.freeDeliveryThreshold(db);
  if (!cart) return emptyCartView(CART_CURRENCY, threshold);
  if (cart.items.length === 0) {
    return emptyCartView(CART_CURRENCY, threshold, `${cart.updatedAt.getTime()}:0`);
  }
  const ids = cart.items.map((item) => item.variantId);
  const [variants, availability] = await Promise.all([
    catalog.getSellableVariants(db, ids),
    inventory.getAvailability(ids),
  ]);
  return buildCartView({
    currency: cart.currency,
    revision: `${cart.updatedAt.getTime()}:${cart.items.length}`,
    threshold,
    lines: cart.items.map((item) => {
      const variant = variants.get(item.variantId);
      return {
        variantId: item.variantId,
        quantity: item.quantity,
        variant: variant ?? null,
        available: availability.get(item.variantId)?.available ?? 0,
      };
    }),
  });
}

/** The bag as the browser should show it. Reading never creates a bag. */
export async function getView(identity: CartIdentity): Promise<CartView> {
  const now = new Date();
  const cart = identity.userId
    ? await db.$transaction((tx) => findCart(tx, identity, now))
    : await findGuestCart(db, identity, now).then((c) => (c ? repo.findById(db, c.id) : null));
  return viewOf(cart);
}

// ---------------------------------------------------------------------------------------------
// Changing the bag
// ---------------------------------------------------------------------------------------------

/** Checks that a variant can go in the bag and returns the most that can be held of it now. */
async function assertBuyable(variantId: string): Promise<number> {
  const variant = (await catalog.getSellableVariants(db, [variantId])).get(variantId);
  if (!variant?.sellable) {
    throw new DomainError('NOT_FOUND', 'That item is no longer available.');
  }
  if (variant.currency !== CART_CURRENCY) {
    throw new DomainError('CONFLICT', 'That item cannot be added to this bag.');
  }
  const available = (await inventory.getAvailability([variantId])).get(variantId)?.available ?? 0;
  if (available <= 0) throw new DomainError('OUT_OF_STOCK', 'That size is sold out.');
  return available;
}

const tooMany = (available: number) =>
  available < MAX_LINE_QUANTITY
    ? new DomainError('OUT_OF_STOCK', `Only ${available} left in that size.`)
    : new DomainError('CONFLICT', `You can order up to ${MAX_LINE_QUANTITY} of one item.`);

/** Adds units of a variant. Stock and the per-line and line caps are enforced here, not in the browser. */
export async function addLine(identity: CartIdentity, input: AddToCartInput): Promise<CartResult> {
  const available = await assertBuyable(input.variantId);
  const now = new Date();
  const { cartId, newToken } = await db.$transaction(async (tx) => {
    const { cart, newToken } = await findOrCreateCart(tx, identity, now);
    await repo.lockCart(tx, cart.id);
    const existing = await repo.findItem(tx, cart.id, input.variantId);
    if (!existing && (await repo.countItems(tx, cart.id)) >= MAX_CART_LINES) {
      throw new DomainError(
        'CONFLICT',
        `Your bag holds ${MAX_CART_LINES} different items. Remove one to add another.`,
      );
    }
    const next = (existing?.quantity ?? 0) + input.quantity;
    if (next > Math.min(available, MAX_LINE_QUANTITY)) throw tooMany(available);
    await repo.upsertItem(tx, cart.id, input.variantId, next);
    await repo.touchCart(tx, cart.id, expiryFrom(now));
    return { cartId: cart.id, newToken };
  });
  return { view: await viewOf(await repo.findById(db, cartId)), newToken };
}

/** Sets a line to an exact quantity; zero removes it. Restoring a removed line is the same call. */
export async function setLineQuantity(
  identity: CartIdentity,
  input: SetLineQuantityInput,
): Promise<CartResult> {
  const now = new Date();
  if (input.quantity === 0) {
    const cartId = await db.$transaction(async (tx) => {
      const cart = await findCart(tx, identity, now);
      if (!cart) return null;
      await repo.lockCart(tx, cart.id);
      await repo.deleteItem(tx, cart.id, input.variantId);
      await repo.touchCart(tx, cart.id, expiryFrom(now));
      return cart.id;
    });
    return { view: await viewOf(cartId ? await repo.findById(db, cartId) : null), newToken: null };
  }

  const available = await assertBuyable(input.variantId);
  if (input.quantity > Math.min(available, MAX_LINE_QUANTITY)) throw tooMany(available);
  const { cartId, newToken } = await db.$transaction(async (tx) => {
    const { cart, newToken } = await findOrCreateCart(tx, identity, now);
    await repo.lockCart(tx, cart.id);
    const existing = await repo.findItem(tx, cart.id, input.variantId);
    if (!existing && (await repo.countItems(tx, cart.id)) >= MAX_CART_LINES) {
      throw new DomainError(
        'CONFLICT',
        `Your bag holds ${MAX_CART_LINES} different items. Remove one to add another.`,
      );
    }
    await repo.upsertItem(tx, cart.id, input.variantId, input.quantity);
    await repo.touchCart(tx, cart.id, expiryFrom(now));
    return { cartId: cart.id, newToken };
  });
  return { view: await viewOf(await repo.findById(db, cartId)), newToken };
}

/** Called after sign-in: folds the guest bag of this browser into the customer's bag. */
export async function mergeGuestCart(identity: CartIdentity): Promise<CartView> {
  return getView(identity);
}

// ---------------------------------------------------------------------------------------------
// For checkout
// ---------------------------------------------------------------------------------------------

export interface CheckoutCart {
  cartId: string;
  currency: string;
  lines: Array<{ variantId: string; quantity: number }>;
}

/** Stable name of whoever owns the bag, used to namespace idempotency keys (INV-O6). */
export function actorKey(identity: CartIdentity): string | null {
  if (identity.userId) return `user:${identity.userId}`;
  return isCartToken(identity.token) ? `guest:${hashCartToken(identity.token).slice(0, 32)}` : null;
}

/** Locks the bag for the length of the caller's transaction and returns its lines. */
export async function loadForCheckout(tx: Tx, identity: CartIdentity): Promise<CheckoutCart> {
  const cart = await findCart(tx, identity, new Date());
  if (!cart) throw new DomainError('VALIDATION', 'Your bag is empty.');
  await repo.lockCart(tx, cart.id);
  const locked = await repo.findById(tx, cart.id);
  if (!locked || locked.items.length === 0) {
    throw new DomainError('VALIDATION', 'Your bag is empty.');
  }
  return {
    cartId: locked.id,
    currency: locked.currency,
    lines: locked.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
  };
}

/** Empties the bag once an order has been placed from it. */
export async function clearCart(tx: Tx, cartId: string): Promise<void> {
  await repo.deleteItems(tx, cartId);
  await repo.touchCart(tx, cartId, expiryFrom(new Date()));
}

/** Deletes bags nobody has touched for 30 days. Safe to run any time. */
export async function purgeExpired(now: Date = new Date()): Promise<number> {
  return (await repo.deleteExpired(db, now)).count;
}
