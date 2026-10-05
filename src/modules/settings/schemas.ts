import { z } from 'zod';

/** Keys in `store_settings` that this module owns. */
export const SETTING_KEYS = {
  checkout: 'checkout.protection',
  cod: 'payments.cod',
} as const;

const minorText = z.string().regex(/^\d{1,15}$/, 'Whole number of minor units');

/**
 * Checkout abuse controls (ARCHITECTURE section 6.1 and 11). Defaults are deliberately moderate:
 * a real customer rarely has more than a couple of orders waiting for a call.
 */
export const checkoutProtectionSchema = z
  .object({
    /** Ask for a code sent by SMS before an order is placed. Off until an SMS gateway is chosen. */
    otpRequired: z.boolean().default(false),
    /** Orders from one phone still waiting for staff (placed, under verification, on hold). */
    maxOpenOrdersPerPhone: z.number().int().min(1).max(20).default(3),
    maxOrdersPerPhonePerDay: z.number().int().min(1).max(50).default(5),
    /** Same delivery address, any phone. */
    maxOpenOrdersPerAddress: z.number().int().min(1).max(20).default(3),
    /** Same network address, in the last 24 hours. */
    maxOrdersPerIpPerDay: z.number().int().min(1).max(100).default(8),
    /** Units of one variant a phone may hold across orders waiting for staff (INV-O11). */
    maxUnitsPerVariantPerPhone: z.number().int().min(1).max(50).default(6),
  })
  .strict();

export type CheckoutProtection = z.infer<typeof checkoutProtectionSchema>;
export const DEFAULT_CHECKOUT_PROTECTION: CheckoutProtection = checkoutProtectionSchema.parse({});

/** Cash on delivery rule: on or off, and the largest order we will send without prepayment. */
export const codSettingsSchema = z
  .object({
    enabled: z.boolean().default(true),
    /** Minor units of the store currency, stored as text because JSON has no bigint. */
    maxOrderMinor: minorText.default('5000000'),
  })
  .strict();

export type CodSettings = z.infer<typeof codSettingsSchema>;
export const DEFAULT_COD_SETTINGS: CodSettings = codSettingsSchema.parse({});

/** What the admin form sends. Amounts are typed in taka. */
export const saveCheckoutSettingsSchema = z
  .object({
    otpRequired: z.boolean(),
    maxOpenOrdersPerPhone: z.number().int().min(1).max(20),
    maxOrdersPerPhonePerDay: z.number().int().min(1).max(50),
    maxOpenOrdersPerAddress: z.number().int().min(1).max(20),
    maxOrdersPerIpPerDay: z.number().int().min(1).max(100),
    maxUnitsPerVariantPerPhone: z.number().int().min(1).max(50),
    codEnabled: z.boolean(),
    codMaxOrder: z.string().trim().min(1).max(20),
  })
  .strict();

export type SaveCheckoutSettingsInput = z.infer<typeof saveCheckoutSettingsSchema>;
