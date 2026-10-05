import { z } from 'zod';

/** Most units of one variant in a bag, and most different lines (caps against abuse and mistakes). */
export const MAX_LINE_QUANTITY = 10;
export const MAX_CART_LINES = 20;

/** One line to add to the bag. Strict: unknown keys (prices, totals) are refused, not ignored. */
export const addToCartSchema = z
  .object({
    variantId: z.uuid(),
    quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  })
  .strict();

/** Sets a line to an exact quantity. Zero removes it, which is also how "undo remove" restores it. */
export const setLineQuantitySchema = z
  .object({
    variantId: z.uuid(),
    quantity: z.number().int().min(0).max(MAX_LINE_QUANTITY),
  })
  .strict();

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type SetLineQuantityInput = z.infer<typeof setLineQuantitySchema>;
