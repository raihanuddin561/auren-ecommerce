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

export const CANCEL_REASON_LABEL: Readonly<Record<OrderCancelReason, string>> = {
  customer_cancelled: 'Customer cancelled',
  fake_order: 'Fake order',
  unreachable: 'Customer unreachable',
  out_of_stock: 'Out of stock',
  duplicate: 'Duplicate order',
  address_unserviceable: 'Address not serviceable',
  payment_failed: 'Payment failed',
  other: 'Other',
};

// ---------------------------------------------------------------------------------------------
// Verification (ARCHITECTURE section 6.1)
// ---------------------------------------------------------------------------------------------

export const VERIFICATION_CHANNELS = ['call', 'sms', 'whatsapp', 'messenger'] as const;
export type VerificationChannelId = (typeof VERIFICATION_CHANNELS)[number];

/** The five things staff confirm before an order can be confirmed. Every one must be ticked. */
export const CHECKLIST_ITEMS = [
  { key: 'genuine', label: 'Customer reachable and the order is genuine' },
  { key: 'items', label: 'Items, size and colour confirmed' },
  { key: 'address', label: 'Delivery address complete and serviceable' },
  { key: 'payment', label: 'Payment checked (COD: the customer agrees to pay the amount)' },
  { key: 'stock', label: 'Stock physically available' },
] as const;

export const verificationChecklistSchema = z
  .object({
    genuine: z.boolean(),
    items: z.boolean(),
    address: z.boolean(),
    payment: z.boolean(),
    stock: z.boolean(),
  })
  .strict();
export type VerificationChecklist = z.infer<typeof verificationChecklistSchema>;

export const isChecklistComplete = (checklist: VerificationChecklist): boolean =>
  Object.values(checklist).every((value) => value === true);

/** Outcomes that mean "we could not finish": the order goes on hold with a time to try again. */
export const HOLD_OUTCOMES = ['no_answer', 'busy', 'wrong_number', 'callback_requested'] as const;
export type HoldOutcome = (typeof HOLD_OUTCOMES)[number];

const orderId = z.uuid();
const note = z.string().trim().max(500).optional();

export const claimOrderSchema = z.object({ orderId }).strict();
export const releaseOrderSchema = z.object({ orderId }).strict();
export const assignOrderSchema = z.object({ orderId, assigneeId: z.uuid() }).strict();

export const confirmOrderSchema = z
  .object({
    orderId,
    checklist: verificationChecklistSchema,
    channel: z.enum(VERIFICATION_CHANNELS).default('call'),
    note,
  })
  .strict();

export const holdOrderSchema = z
  .object({
    orderId,
    outcome: z.enum(HOLD_OUTCOMES).default('callback_requested'),
    channel: z.enum(VERIFICATION_CHANNELS).default('call'),
    note,
    nextAttemptAt: z.coerce.date().optional(),
  })
  .strict();

export const cancelOrderSchema = z
  .object({
    orderId,
    reason: z.enum(ORDER_CANCEL_REASONS),
    note,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.reason === 'other' && !value.note) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Say why the order is cancelled.' });
    }
  });

export const addOrderNoteSchema = z
  .object({ orderId, note: z.string().trim().min(1).max(500) })
  .strict();

/** The address fields staff may correct while verifying (the same shape checkout sends). */
export const editAddressSchema = z
  .object({
    divisionId: z.string().trim().min(1).max(64),
    divisionName: z.string().trim().max(80).optional(),
    districtId: z.string().trim().min(1).max(64),
    districtName: z.string().trim().max(80).optional(),
    thanaId: z.string().trim().max(64).nullish(),
    thanaName: z.string().trim().max(80).optional(),
    area: z.string().trim().min(2).max(120),
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).nullish(),
    postalCode: z.string().trim().max(12).nullish(),
  })
  .strict();

export const editOrderSchema = z
  .object({
    orderId,
    /** The lines the order should have after the edit. A line that keeps its item id keeps its price. */
    lines: z
      .array(
        z
          .object({
            itemId: z.uuid().optional(),
            variantId: z.uuid(),
            quantity: z.number().int().min(1).max(50),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    address: editAddressSchema.optional(),
    note,
  })
  .strict();
export type EditOrderInput = z.infer<typeof editOrderSchema>;

export const assignableStaffSchema = z.object({}).strict();

// ---------------------------------------------------------------------------------------------
// Manual order entry (6.5)
// ---------------------------------------------------------------------------------------------

export const MANUAL_CHANNELS = ['manual', 'facebook', 'instagram', 'whatsapp', 'store'] as const;
export type ManualChannel = (typeof MANUAL_CHANNELS)[number];

export const CHANNEL_LABEL: Readonly<Record<string, string>> = {
  web: 'Website',
  manual: 'Phone',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  store: 'In store',
};

export const manualOrderSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_\-:.]{8,128}$/),
    channel: z.enum(MANUAL_CHANNELS),
    contact: z
      .object({
        name: z.string().trim().min(2).max(100),
        phone: z.string().trim().min(6).max(30),
        email: z.string().trim().max(254).optional(),
      })
      .strict(),
    address: editAddressSchema,
    lines: z
      .array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(50) }).strict())
      .min(1)
      .max(30),
    shippingRateId: z.string().trim().max(64).optional(),
    customerNote: z.string().trim().max(500).optional(),
  })
  .strict();
export type ManualOrderInput = z.infer<typeof manualOrderSchema>;

// ---------------------------------------------------------------------------------------------
// Fulfilment (6.7 to 6.11)
// ---------------------------------------------------------------------------------------------

export const searchVariantsSchema = z.object({ q: z.string().trim().min(1).max(80) }).strict();
