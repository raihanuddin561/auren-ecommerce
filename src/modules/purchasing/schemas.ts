import { z } from 'zod';

export const LANDED_COST_TYPES = [
  'freight',
  'customs_duty',
  'inbound_transport',
  'agent_fee',
  'other',
] as const;
export type LandedCostTypeValue = (typeof LANDED_COST_TYPES)[number];

export const LANDED_COST_LABELS: Readonly<Record<LandedCostTypeValue, string>> = {
  freight: 'Freight',
  customs_duty: 'Customs duty',
  inbound_transport: 'Inbound transport',
  agent_fee: 'Agent fee',
  other: 'Other',
};

export const ALLOCATION_LABELS = {
  by_quantity: 'By quantity',
  by_value: 'By value',
} as const;

/** A money amount typed by staff, in major units: "1250" or "1250.50". Converted by lib/money. */
const amount = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Enter an amount such as 1250 or 1250.50');

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(z.email().optional());

export const supplierFieldsSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(120),
    contactName: optionalText(120),
    phone: optionalText(40),
    email: optionalEmail,
    address: optionalText(300),
    paymentTerms: optionalText(120),
    notes: optionalText(1000),
  })
  .strict();
export type SupplierFields = z.input<typeof supplierFieldsSchema>;

export const updateSupplierSchema = supplierFieldsSchema
  .extend({ id: z.uuid(), isActive: z.boolean() })
  .strict();
export type UpdateSupplierInput = z.input<typeof updateSupplierSchema>;

const lineSchema = z
  .object({
    variantId: z.uuid(),
    quantityOrdered: z.number().int().min(1).max(100_000),
    unitCost: amount,
  })
  .strict();

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date such as 2026-11-30')
  .optional()
  .transform((value) => (value ? value : undefined));

const poFields = {
  supplierId: z.uuid(),
  expectedAt: dateOnly,
  notes: optionalText(1000),
  lines: z.array(lineSchema).min(1, 'Add at least one line').max(200),
};

const uniqueVariants = (lines: ReadonlyArray<{ variantId: string }>) =>
  new Set(lines.map((line) => line.variantId)).size === lines.length;

export const createPurchaseOrderSchema = z
  .object(poFields)
  .strict()
  .refine((value) => uniqueVariants(value.lines), {
    path: ['lines'],
    message: 'Each variant can appear once',
  });
export type CreatePurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderSchema = z
  .object({ id: z.uuid(), ...poFields })
  .strict()
  .refine((value) => uniqueVariants(value.lines), {
    path: ['lines'],
    message: 'Each variant can appear once',
  });
export type UpdatePurchaseOrderInput = z.input<typeof updatePurchaseOrderSchema>;

export const purchaseOrderIdSchema = z.object({ id: z.uuid() }).strict();

export const cancelPurchaseOrderSchema = z
  .object({ id: z.uuid(), reason: optionalText(300) })
  .strict();

export const addLandedCostSchema = z
  .object({
    poId: z.uuid(),
    type: z.enum(LANDED_COST_TYPES),
    amount,
    method: z.enum(['by_quantity', 'by_value']),
    note: optionalText(200),
  })
  .strict();
export type AddLandedCostInput = z.input<typeof addLandedCostSchema>;

export const removeLandedCostSchema = z.object({ id: z.uuid() }).strict();

export const receiveGoodsSchema = z
  .object({
    poId: z.uuid(),
    /** Generated when the form opens; a double click or a retry replays instead of receiving twice. */
    idempotencyKey: z.string().min(8).max(128),
    locationId: z.uuid().optional(),
    notes: optionalText(500),
    lines: z
      .array(
        z.object({ poItemId: z.uuid(), quantity: z.number().int().min(1).max(100_000) }).strict(),
      )
      .min(1, 'Enter a quantity for at least one line')
      .max(200),
  })
  .strict()
  .refine(
    (value) => new Set(value.lines.map((line) => line.poItemId)).size === value.lines.length,
    {
      path: ['lines'],
      message: 'Each line can appear once',
    },
  );
export type ReceiveGoodsInput = z.input<typeof receiveGoodsSchema>;

export const searchVariantsSchema = z.object({ q: z.string().trim().min(1).max(80) }).strict();

export const supplierListSchema = z
  .object({ q: z.string().trim().max(80).optional(), includeInactive: z.boolean().default(false) })
  .strict();

export const poListSchema = z
  .object({
    status: z
      .enum(['all', 'draft', 'ordered', 'partially_received', 'received', 'cancelled'])
      .default('all'),
    supplierId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();
export type PoListParams = z.infer<typeof poListSchema>;
