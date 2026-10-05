import type { Tx } from '@/lib/db';

/** Data access for bags. No business rules here. */

const withItems = { items: { orderBy: { addedAt: 'asc' as const } } };

export const findByTokenHash = (tx: Tx, tokenHash: string) =>
  tx.cart.findUnique({ where: { tokenHash }, include: withItems });

export const findByUserId = (tx: Tx, userId: string) =>
  tx.cart.findUnique({ where: { userId }, include: withItems });

export const findById = (tx: Tx, id: string) =>
  tx.cart.findUnique({ where: { id }, include: withItems });

export const createCart = (
  tx: Tx,
  data: { tokenHash: string | null; userId: string | null; currency: string; expiresAt: Date },
) => tx.cart.create({ data, include: withItems });

/** Serialises writers of one bag so the line cap and quantities cannot race. */
export async function lockCart(tx: Tx, cartId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM carts WHERE id = ${cartId}::uuid FOR UPDATE`;
}

export const touchCart = (tx: Tx, cartId: string, expiresAt: Date) =>
  tx.cart.update({ where: { id: cartId }, data: { expiresAt } });

export const findItem = (tx: Tx, cartId: string, variantId: string) =>
  tx.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });

export const countItems = (tx: Tx, cartId: string) => tx.cartItem.count({ where: { cartId } });

export const upsertItem = (tx: Tx, cartId: string, variantId: string, quantity: number) =>
  tx.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity },
    update: { quantity },
  });

export const deleteItem = (tx: Tx, cartId: string, variantId: string) =>
  tx.cartItem.deleteMany({ where: { cartId, variantId } });

export const deleteItems = (tx: Tx, cartId: string) =>
  tx.cartItem.deleteMany({ where: { cartId } });

export const deleteCart = (tx: Tx, cartId: string) => tx.cart.deleteMany({ where: { id: cartId } });

export const adoptCart = (tx: Tx, cartId: string, userId: string, expiresAt: Date) =>
  tx.cart.update({ where: { id: cartId }, data: { userId, tokenHash: null, expiresAt } });

export const deleteExpired = (tx: Tx, now: Date) =>
  tx.cart.deleteMany({ where: { expiresAt: { lt: now } } });
