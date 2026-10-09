import { z } from 'zod';

export const expenseCategoryTypeEnum = z.enum([
  'marketing',
  'payroll',
  'rent',
  'utilities',
  'software',
  'photography',
  'packaging_stock',
  'logistics',
  'professional_fees',
  'bank_charges',
  'misc',
]);

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  type: expenseCategoryTypeEnum,
  isCogs: z.boolean().default(false),
  description: z.string().trim().max(300).optional().nullable(),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial().extend({
  id: z.string().uuid(),
});

export const marketingCampaignChannelEnum = z.enum([
  'meta',
  'google',
  'tiktok',
  'influencer',
  'email',
  'offline',
]);

export const createMarketingCampaignSchema = z.object({
  name: z.string().trim().min(2, 'Campaign name required').max(100),
  channel: marketingCampaignChannelEnum,
  utmCampaign: z.string().trim().max(100).optional().nullable(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required'),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required')
    .optional()
    .nullable(),
  budgetMinor: z.bigint().nonnegative().default(0n),
});

export const updateMarketingCampaignSchema = createMarketingCampaignSchema.partial().extend({
  id: z.string().uuid(),
});

export const recurringExpenseCadenceEnum = z.enum(['monthly', 'weekly', 'yearly']);

export const createRecurringExpenseSchema = z.object({
  categoryId: z.string().uuid('Valid expense category required'),
  vendor: z.string().trim().min(2, 'Vendor name required').max(100),
  amountMinor: z.bigint().positive('Amount must be greater than zero'),
  currency: z.string().length(3).default('BDT'),
  cadence: recurringExpenseCadenceEnum.default('monthly'),
  dayOfPeriod: z.number().int().min(1).max(31).default(1),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required'),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required')
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
});

export const updateRecurringExpenseSchema = createRecurringExpenseSchema.partial().extend({
  id: z.string().uuid(),
});

export const createExpenseSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required'),
  categoryId: z.string().uuid('Valid expense category required'),
  campaignId: z.string().uuid().optional().nullable(),
  recurringExpenseId: z.string().uuid().optional().nullable(),
  vendor: z.string().trim().min(2, 'Vendor name required').max(100),
  description: z.string().trim().min(2, 'Description required').max(300),
  amountMinor: z.bigint().positive('Amount must be greater than zero'),
  currency: z.string().length(3).default('BDT'),
  paymentMethod: z.string().trim().min(2).max(50).default('bank_transfer'),
  reference: z.string().trim().max(100).optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial().extend({
  id: z.string().uuid(),
});

export const expenseFilterSchema = z.object({
  categoryId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().trim().max(100).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export const pAndLFilterSchema = z.object({
  recognitionMode: z.enum(['placed', 'delivered']).default('delivered'),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  grouping: z.enum(['day', 'week', 'month']).default('month'),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;
export type CreateMarketingCampaignInput = z.infer<typeof createMarketingCampaignSchema>;
export type UpdateMarketingCampaignInput = z.infer<typeof updateMarketingCampaignSchema>;
export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;
export type UpdateRecurringExpenseInput = z.infer<typeof updateRecurringExpenseSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>;
export type PAndLFilterInput = z.infer<typeof pAndLFilterSchema>;
