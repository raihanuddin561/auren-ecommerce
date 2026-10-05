import { z } from 'zod';

/** The phone number or email address on the order. */
const factor = z.string().trim().min(5).max(254);

export const lookupOrderSchema = z
  .object({
    orderNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^AUR-\d{4,9}$/, 'Enter your order number, for example AUR-100001.'),
    factor,
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

export const unlockOrderSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    factor,
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

export const GENERIC_NOT_FOUND =
  'We could not find an order with those details. Check the order number and the phone number or email you used.';

export const ORDER_CANCEL_REASONS = [
  'customer_cancelled',
  'fake_order',
  'unreachable',
  'out_of_stock',
  'duplicate',
  'address_unserviceable',
  'payment_failed',
  'other',
] as const;

export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number];

export const confirmOrderSchema = z
  .object({
    orderId: z.uuid(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const holdOrderSchema = z
  .object({
    orderId: z.uuid(),
    note: z.string().trim().max(500).optional(),
    nextAttemptAt: z.coerce.date().optional(),
  })
  .strict();

export const cancelOrderSchema = z
  .object({
    orderId: z.uuid(),
    reason: z.enum(ORDER_CANCEL_REASONS),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
