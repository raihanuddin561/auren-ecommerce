import { z } from 'zod';

export const ADJUSTMENT_REASONS = [
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

/** Reasons that need a written explanation. */
const NOTE_REQUIRED: readonly AdjustmentReason[] = ['write_off', 'other'];

export const REASON_LABELS: Readonly<Record<AdjustmentReason, string>> = {
  count_correction: 'Stock count correction',
  found: 'Found stock',
  damaged: 'Damaged',
  lost: 'Lost',
  write_off: 'Write-off',
  other: 'Other',
};

const MAX_QUANTITY = 1_000_000;

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
  })
  .strict()
  .superRefine((value, ctx) => {
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

export const stockListSchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    status: z.enum(['all', 'in_stock', 'low', 'out']).default('all'),
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
