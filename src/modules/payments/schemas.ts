import { z } from 'zod';

/** Step-up purpose for money going back to a customer (INV-A6). The UI confirms it with the password. */
export const REFUND_STEP_UP = 'orders.refund';

const amountText = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Enter an amount such as 120 or 120.50');

export const refundOrderSchema = z
  .object({
    orderId: z.uuid(),
    /** An existing refund request to process (a cancelled paid order), or an amount for a new refund. */
    refundId: z.uuid().optional(),
    amount: amountText.optional(),
    method: z.enum(['original', 'store_credit', 'manual_bkash']),
    reason: z.string().trim().min(3).max(200),
    note: z.string().trim().max(500).optional(),
    providerRef: z.string().trim().max(80).optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_\-:.]{8,128}$/),
  })
  .strict()
  .refine((value) => Boolean(value.refundId) || Boolean(value.amount), {
    message: 'Enter the amount to refund.',
    path: ['amount'],
  });

export const declineRefundSchema = z
  .object({ orderId: z.uuid(), refundId: z.uuid(), note: z.string().trim().min(3).max(300) })
  .strict();

export const requestRefundApprovalSchema = z
  .object({
    orderId: z.uuid(),
    amount: amountText,
    reason: z.string().trim().min(3).max(300),
  })
  .strict();
