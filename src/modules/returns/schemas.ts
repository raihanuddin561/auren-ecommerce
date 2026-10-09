import { z } from 'zod';

const amountText = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Enter an amount such as 120 or 120.50');

export const RETURN_REASON_LABEL = {
  too_small: 'Too small',
  too_large: 'Too large',
  defective: 'Defective or damaged on arrival',
  not_as_described: 'Not as described',
  changed_mind: 'Changed my mind',
} as const;

export const RETURN_STATUS_LABEL: Readonly<Record<string, string>> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  in_transit: 'On its way back',
  received: 'Received',
  inspected: 'Inspected',
  refunded: 'Refunded',
  exchanged: 'Exchanged',
  closed: 'Closed',
};

/** What the customer sends from the order page. The order is found by the tracking token and proof cookie. */
export const customerReturnSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    type: z.enum(['return', 'exchange']),
    items: z
      .array(
        z
          .object({
            orderItemId: z.uuid(),
            quantity: z.number().int().min(1).max(50),
            reason: z.enum([
              'too_small',
              'too_large',
              'defective',
              'not_as_described',
              'changed_mind',
            ]),
            exchangeVariantId: z.uuid().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    note: z.string().trim().max(500).optional(),
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

const returnId = z.uuid();

export const approveReturnSchema = z
  .object({ returnId, note: z.string().trim().max(500).optional() })
  .strict();

export const rejectReturnSchema = z
  .object({ returnId, reason: z.string().trim().min(3).max(500) })
  .strict();

export const receiveReturnSchema = z
  .object({ returnId, shippingCost: amountText.default('0') })
  .strict();

export const inspectReturnSchema = z
  .object({
    returnId,
    conditions: z
      .array(
        z.object({ returnItemId: z.uuid(), condition: z.enum(['resellable', 'damaged']) }).strict(),
      )
      .min(1)
      .max(50),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const resolveReturnSchema = z
  .object({
    returnId,
    resolution: z.enum(['refund', 'store_credit', 'exchange']),
    /** Taka. Default: what the returned items were sold for. */
    amount: amountText.optional(),
    refundMethod: z.enum(['original', 'manual_bkash']).optional(),
    providerRef: z.string().trim().max(80).optional(),
    note: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_\-:.]{8,128}$/),
  })
  .strict();

export const closeReturnSchema = z
  .object({ returnId, note: z.string().trim().min(3).max(500) })
  .strict();

export const shipReplacementSchema = z
  .object({
    orderId: z.uuid(),
    courierName: z.string().trim().min(2).max(80),
    trackingNumber: z.string().trim().min(1).max(80),
    cost: amountText.default('0'),
  })
  .strict();
