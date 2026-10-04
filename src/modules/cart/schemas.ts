import { z } from 'zod';

export const MAX_LINE_QUANTITY = 10;

/** One line to add to the bag. Strict: unknown keys are refused rather than ignored. */
export const addToCartSchema = z
  .object({
    variantId: z.uuid(),
    quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
  })
  .strict();

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export interface AddToCartResult {
  variantId: string;
  quantity: number;
  /** False until the cart stage stores lines: nothing has been saved yet. */
  persisted: boolean;
}
