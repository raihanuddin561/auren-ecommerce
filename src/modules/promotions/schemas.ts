import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const discountTypeEnum = z.enum([
  'percentage',
  'fixed_amount',
  'free_shipping',
  'buy_x_get_y',
]);

export const discountAppliesToEnum = z.enum(['order', 'products', 'collections', 'categories']);

export const discountCustomerEligibilityEnum = z.enum(['all', 'new', 'segment']);

export const createDiscountSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9\-_]{3,30}$/, 'Code must be 3-30 letters, numbers, hyphens or underscores')
      .optional()
      .nullable(),
    title: text(2, 120),
    type: discountTypeEnum,
    value: z.coerce.number().min(0, 'Value must be positive'),
    appliesTo: discountAppliesToEnum.default('order'),
    targetIds: z.array(z.string().uuid()).default([]),
    minSubtotal: z.coerce.number().min(0).optional().nullable(),
    minQuantity: z.coerce.number().int().min(1).optional().nullable(),
    maxDiscount: z.coerce.number().min(0).optional().nullable(),
    customerEligibility: discountCustomerEligibilityEnum.default('all'),
    usageLimit: z.coerce.number().int().min(1).optional().nullable(),
    usageLimitPerCustomer: z.coerce.number().int().min(1).optional().nullable(),
    combinable: z.boolean().default(false),
    startsAt: z.coerce.date().default(() => new Date()),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .strict();

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

export const updateDiscountSchema = createDiscountSchema
  .partial()
  .extend({
    id: z.string().uuid(),
  })
  .strict();

export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;

export const toggleDiscountSchema = z
  .object({
    id: z.string().uuid(),
    isActive: z.boolean(),
  })
  .strict();

export type ToggleDiscountInput = z.infer<typeof toggleDiscountSchema>;

/** Storefront coupon submission schema. */
export const applyCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, 'Enter a valid promo code')
      .max(50, 'Code too long'),
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

export const removeCouponSchema = z.object({}).strict();
