import { z } from 'zod';

/** An amount typed by staff in taka: "1250" or "1250.50". Converted with lib/money, never parsed as a float. */
export const amountText = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Enter an amount such as 120 or 120.50');

const orderId = z.uuid();
const shipmentId = z.uuid();

export const COURIER_CHOICES = ['manual', 'pathao', 'steadfast'] as const;

export const startProcessingSchema = z.object({ orderId }).strict();

export const shipOrderSchema = z
  .object({
    orderId,
    courier: z.enum(COURIER_CHOICES),
    /** Manual courier: who carries the parcel ("Sundarban", "Own rider"). */
    courierName: z.string().trim().max(80).optional(),
    trackingNumber: z.string().trim().max(80).optional(),
    /** What the courier charges us, in taka. */
    cost: amountText.optional(),
    weightG: z.number().int().min(1).max(100_000).optional(),
    note: z.string().trim().max(300).optional(),
    packagingProfileId: z.uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.courier !== 'manual') return;
    if (!value.courierName) {
      ctx.addIssue({ code: 'custom', path: ['courierName'], message: 'Enter the courier name.' });
    }
    if (!value.trackingNumber) {
      ctx.addIssue({
        code: 'custom',
        path: ['trackingNumber'],
        message: 'Enter the tracking number.',
      });
    }
  });
export type ShipOrderForm = z.infer<typeof shipOrderSchema>;

/** The statuses staff can set by hand (the manual courier). The courier API reports the others. */
export const MANUAL_PARCEL_STATUSES = [
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
] as const;

export const parcelStatusSchema = z
  .object({
    orderId,
    shipmentId,
    status: z.enum(MANUAL_PARCEL_STATUSES),
    note: z.string().trim().max(300).optional(),
    /** The courier's collection fee on delivery, in taka. */
    codFee: amountText.optional(),
  })
  .strict();

export const parcelDetailsSchema = z
  .object({
    orderId,
    shipmentId,
    courierName: z.string().trim().max(80).optional(),
    trackingNumber: z.string().trim().min(1).max(80).optional(),
    cost: amountText.optional(),
    codFee: amountText.optional(),
  })
  .strict();

export const returnToOriginSchema = z
  .object({
    orderId,
    condition: z.enum(['resellable', 'damaged']),
    /** Return courier fee and any other loss, in taka. */
    loss: amountText.default('0'),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const addCostSchema = z
  .object({
    orderId,
    amount: amountText.refine((value) => /[1-9]/.test(value), 'Enter an amount above zero'),
    note: z.string().trim().min(2).max(200),
  })
  .strict();
