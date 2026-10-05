import { z } from 'zod';

const uuid = z.uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Contact. Phone first: it is how our team reaches the customer to confirm the order. */
export const contactSchema = z
  .object({
    name: text(2, 80),
    phone: text(10, 20),
    /** Optional; an empty string counts as none. */
    email: z.union([z.literal(''), z.email().max(120)]).optional(),
  })
  .strict();

export const addressSchema = z
  .object({
    divisionId: uuid,
    districtId: uuid,
    /** A listed thana or upazila. When the customer's is not listed, `thanaName` carries it. */
    thanaId: uuid.nullish(),
    thanaName: text(2, 60).optional(),
    /** Neighbourhood or locality, free text. */
    area: text(2, 80),
    line1: text(5, 160),
    line2: text(1, 160).optional(),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'A postal code has 4 digits')
      .optional(),
  })
  .strict();

/**
 * Everything the browser may say about an order. Prices, discounts, shipping fees and totals are
 * absent on purpose: `.strict()` refuses them if sent, and the server reads all of them from the
 * database (INV-M3, INV-O8). The bag itself is found by its cookie, not named by the client.
 */
export const placeOrderSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_\-:.]{8,128}$/),
    contact: contactSchema,
    address: addressSchema,
    shippingRateId: uuid.optional(),
    paymentMethod: z.enum(['cod']),
    customerNote: text(1, 300).optional(),
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

/** What the page asks while the customer fills the form: delivery options for an area. */
export const quoteSchema = z
  .object({
    divisionId: uuid,
    districtId: uuid,
    thanaId: uuid.nullish(),
    shippingRateId: uuid.optional(),
  })
  .strict();

export const requestOtpSchema = z
  .object({ phone: text(10, 20), turnstileToken: z.string().max(2048).optional() })
  .strict();

export const verifyOtpSchema = z
  .object({ phone: text(10, 20), code: z.string().regex(/^\d{6}$/, 'Enter the 6 digit code') })
  .strict();

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
