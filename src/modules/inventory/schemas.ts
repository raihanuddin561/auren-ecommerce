import { z } from 'zod';

export const ADJUSTMENT_REASONS = [
  'opening_stock',
  'count_correction',
  'found',
  'damaged',
  'lost',
  'write_off',
  'other',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** Reasons that remove stock and are recorded as write-offs (they need a fresh step-up, INV-A6). */
export const WRITE_OFF_REASONS: readonly AdjustmentReason[] = ['damaged', 'lost', 'write_off'];
export const isWriteOffReason = (reason: AdjustmentReason) => WRITE_OFF_REASONS.includes(reason);

/** Step-up purpose for stock write-offs (INV-A6). The UI confirms it through confirmStepUp. */
export const WRITE_OFF_STEP_UP = 'inventory.write_off';

/** Step-up purpose for setting a missing cost basis (INV-A6): it changes every profit figure. */
export const SET_COST_STEP_UP = 'inventory.set_cost';

/** Reasons that can only add units. */
export const ADD_ONLY_REASONS: readonly AdjustmentReason[] = ['opening_stock', 'found'];

/** Reasons that need a written explanation. */
const NOTE_REQUIRED: readonly AdjustmentReason[] = ['write_off', 'other'];

export const REASON_LABELS: Readonly<Record<AdjustmentReason, string>> = {
  opening_stock: 'Opening stock',
  count_correction: 'Stock count correction',
  found: 'Found stock',
  damaged: 'Damaged',
  lost: 'Lost',
  write_off: 'Write-off',
  other: 'Other',
};

const MAX_QUANTITY = 1_000_000;

/** A unit cost typed by staff in major units ("1250" or "1250.50"), above zero. Converted by lib/money. */
export const unitCostText = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Enter an amount such as 1250 or 1250.50')
  .refine((value) => /[1-9]/.test(value), 'Cost must be above zero');

const mode = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('delta'),
    delta: z.number().int().min(-MAX_QUANTITY).max(MAX_QUANTITY),
  }),
  z.object({ mode: z.literal('set'), counted: z.number().int().min(0).max(MAX_QUANTITY) }),
]);

export const adjustStockSchema = z
  .object({
    variantId: z.uuid(),
    locationId: z.uuid().optional(),
    reason: z.enum(ADJUSTMENT_REASONS),
    note: z.string().trim().max(500).optional(),
    change: mode,
    /** Cost per unit of the units being added. Required when the variant has no cost basis yet. */
    unitCost: unitCostText.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.unitCost !== undefined && value.change.mode === 'delta' && value.change.delta < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['unitCost'],
        message: 'A unit cost applies only when adding stock.',
      });
    }
    if (NOTE_REQUIRED.includes(value.reason) && !value.note) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Add a short explanation.' });
    }
  });
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

/**
 * Removing stock needs a fresh step-up (INV-A6), whatever the reason is called: write-offs, any
 * negative change, and an absolute count (which may lower the quantity). Only a plain addition is free.
 */
export const needsStepUp = (input: Pick<AdjustStockInput, 'reason' | 'change'>): boolean =>
  isWriteOffReason(input.reason) || input.change.mode === 'set' || input.change.delta < 0;

/**
 * Sets the cost of variants that have none: one variant, or every variant of a product that is
 * still without cost. Never changes an existing cost (that comes from receipts).
 */
export const setCostBasisSchema = z
  .object({
    scope: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('variant'), variantId: z.uuid() }).strict(),
      z.object({ kind: z.literal('product'), productId: z.uuid() }).strict(),
    ]),
    unitCost: unitCostText,
  })
  .strict();
export type SetCostBasisInput = z.infer<typeof setCostBasisSchema>;

export const costPreviewSchema = z.object({ productId: z.uuid() }).strict();

export const stockListSchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    status: z.enum(['all', 'in_stock', 'low', 'out', 'no_cost']).default('all'),
    categoryId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();
export type StockListParams = z.infer<typeof stockListSchema>;

export const movementListSchema = z
  .object({
    variantId: z.uuid().optional(),
    type: z
      .enum([
        'receipt',
        'sale',
        'reservation',
        'release',
        'return_restock',
        'adjustment',
        'transfer_in',
        'transfer_out',
        'write_off',
      ])
      .optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();
export type MovementListParams = z.infer<typeof movementListSchema>;
