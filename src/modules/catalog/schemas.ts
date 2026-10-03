import { z } from 'zod';
import { RULE_FIELDS, RULE_OPERATORS_BY_FIELD } from './collection-rules';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from './slug';

/** Every action input is strict: unknown keys are rejected, never silently dropped (INV-A1). */

const id = z.uuid();

/** Form fields arrive as strings; an empty field means "no value". */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

const requiredText = (max: number, label = 'This field') =>
  z.string().trim().min(1, `${label} is required`).max(max);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Slug is required')
  .max(SLUG_MAX_LENGTH)
  .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single hyphens');

/** A slug field that may be left empty (derived from the title or name). */
const optionalSlug = z
  .string()
  .trim()
  .toLowerCase()
  .max(SLUG_MAX_LENGTH)
  .transform((value) => (value === '' ? null : value))
  .pipe(slugSchema.nullable());

/** A price typed by a person ("2,490" or "2490.50"). Parsed with lib/money in the service. */
export const moneyText = z
  .string()
  .trim()
  .max(20)
  .regex(/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/, 'Enter an amount such as 2490 or 2,490.50');

const optionalMoneyText = z
  .string()
  .trim()
  .max(20)
  .transform((value) => (value === '' ? null : value))
  .pipe(moneyText.nullable());

/** An integer typed into a form: '' means no value. */
const optionalInt = (min: number, max: number) =>
  z
    .union([
      z.number(),
      z
        .string()
        .trim()
        .regex(/^(\d+)?$/, 'Enter a whole number'),
      z.null(),
    ])
    .transform((value) => (value === '' || value === null ? null : Number(value)))
    .pipe(z.number().int().min(min).max(max).nullable());

const seoFields = {
  seoTitle: text(70),
  seoDescription: text(160),
};

// ---------------------------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------------------------

const categoryFields = {
  name: requiredText(80, 'Name'),
  /** Blank = derived from the name. */
  slug: optionalSlug,
  parentId: id.nullable(),
  description: text(1000),
  isActive: z.boolean(),
  ...seoFields,
};

export const createCategorySchema = z.object(categoryFields).strict();
export const updateCategorySchema = z.object({ id, ...categoryFields }).strict();
export const reorderCategoriesSchema = z
  .object({ parentId: id.nullable(), orderedIds: z.array(id).min(1).max(200) })
  .strict();
export const deleteCategorySchema = z.object({ id }).strict();

// ---------------------------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------------------------

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export const PRODUCT_FITS = ['slim', 'regular', 'relaxed'] as const;

export const createProductSchema = z
  .object({
    title: requiredText(140, 'Title'),
    categoryId: id.nullable(),
    productType: text(60),
  })
  .strict();

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9 -]*$/, 'Tags use letters, numbers, spaces and hyphens');

export const productDetailsSchema = z
  .object({
    id,
    title: requiredText(140, 'Title'),
    subtitle: text(160),
    description: text(8000),
    slug: slugSchema,
    categoryId: id.nullable(),
    sizeChartId: id.nullable(),
    productType: text(60),
    material: text(200),
    careInstructions: text(1000),
    fit: z.enum(PRODUCT_FITS).nullable(),
    origin: text(60),
    tags: z.array(tagSchema).max(20),
    attributes: z
      .object({
        fabric: text(60),
        occasion: text(60),
        season: text(60),
        pattern: text(60),
      })
      .strict(),
    featuredRank: optionalInt(1, 10_000),
    ...seoFields,
  })
  .strict();
export type ProductDetailsInput = z.infer<typeof productDetailsSchema>;

export const productStatusSchema = z.object({ id, status: z.enum(PRODUCT_STATUSES) }).strict();

export const optionValueSchema = z
  .object({
    /** Present for a value that already exists: keeps its variants through a rename. */
    id: id.optional(),
    label: requiredText(40, 'Value'),
    swatchHex: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .pipe(
        z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour such as #1F2A44')
          .nullable(),
      ),
  })
  .strict();

export const optionSchema = z
  .object({
    /** Present for an option that already exists: keeps its variants through a rename. */
    id: id.optional(),
    name: requiredText(30, 'Option name'),
    values: z.array(optionValueSchema).min(1, 'Add at least one value').max(30),
  })
  .strict();

export const generateVariantsSchema = z
  .object({
    productId: id,
    options: z.array(optionSchema).max(3),
    defaults: z
      .object({
        price: moneyText,
        compareAt: optionalMoneyText,
        weightG: optionalInt(0, 100_000),
        skuPrefix: z
          .string()
          .trim()
          .max(12)
          .regex(/^[A-Za-z0-9]*$/, 'Letters and numbers only'),
      })
      .strict(),
  })
  .strict();
export type GenerateVariantsInput = z.infer<typeof generateVariantsSchema>;

export const skuSchema = z
  .string()
  .trim()
  .min(1, 'SKU is required')
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Letters, numbers, dots, hyphens and underscores');

export const variantRowSchema = z
  .object({
    id,
    sku: skuSchema,
    barcode: text(64),
    price: moneyText,
    compareAt: optionalMoneyText,
    weightG: optionalInt(0, 100_000),
    status: z.enum(PRODUCT_STATUSES),
  })
  .strict();

export const updateVariantsSchema = z
  .object({ productId: id, variants: z.array(variantRowSchema).min(1).max(250) })
  .strict();
export type UpdateVariantsInput = z.infer<typeof updateVariantsSchema>;

// ---------------------------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------------------------

export const MAX_MEDIA_PER_PRODUCT = 12;

export const altTextSchema = z
  .string()
  .trim()
  .min(1, 'Describe the image (alt text is required)')
  .max(200);

/** FormData fields of one upload. The file itself is checked by validateUpload (magic bytes). */
export const uploadMediaFieldsSchema = z
  .object({ productId: id, alt: altTextSchema, optionValueId: id.nullable() })
  .strict();

export const updateMediaSchema = z
  .object({ id, alt: altTextSchema, optionValueId: id.nullable() })
  .strict();
export const reorderMediaSchema = z
  .object({ productId: id, orderedIds: z.array(id).min(1).max(MAX_MEDIA_PER_PRODUCT) })
  .strict();
export const deleteMediaSchema = z.object({ id }).strict();

export const uploadCategoryImageFieldsSchema = z
  .object({ categoryId: id, alt: altTextSchema })
  .strict();
export const removeCategoryImageSchema = z.object({ categoryId: id }).strict();

// ---------------------------------------------------------------------------------------------
// Size charts
// ---------------------------------------------------------------------------------------------

const cell = z.string().trim().max(20);

const sizeChartFields = {
  name: requiredText(80, 'Name'),
  unit: z.enum(['cm', 'in']),
  columns: z.array(requiredText(20, 'Measurement name')).min(1).max(8),
  rows: z
    .array(z.object({ size: requiredText(20, 'Size'), values: z.array(cell).max(8) }).strict())
    .min(1, 'Add at least one size')
    .max(30),
  howToMeasure: text(2000),
  modelInfo: text(500),
};

function sizeChartRefinement(
  chart: { columns: string[]; rows: Array<{ size: string; values: string[] }> },
  ctx: z.RefinementCtx,
): void {
  chart.rows.forEach((row, index) => {
    if (row.values.length !== chart.columns.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows', index, 'values'],
        message: 'Each size needs a value for every measurement',
      });
    }
  });
  const sizes = chart.rows.map((r) => r.size.toLowerCase());
  if (new Set(sizes).size !== sizes.length) {
    ctx.addIssue({ code: 'custom', path: ['rows'], message: 'Sizes must be different' });
  }
}

export const createSizeChartSchema = z
  .object(sizeChartFields)
  .strict()
  .superRefine(sizeChartRefinement);
export const updateSizeChartSchema = z
  .object({ id, ...sizeChartFields })
  .strict()
  .superRefine(sizeChartRefinement);
export const deleteSizeChartSchema = z.object({ id }).strict();
export type SizeChartInput = z.infer<typeof createSizeChartSchema>;

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------

export const COLLECTION_SORTS = [
  'manual',
  'best_selling',
  'newest',
  'price_asc',
  'price_desc',
] as const;
export const COLLECTION_TYPES = ['manual', 'automatic'] as const;

export const ruleConditionSchema = z
  .object({
    field: z.enum(RULE_FIELDS),
    operator: z.string().trim().max(20),
    value: z.string().trim().min(1, 'Enter a value').max(80),
  })
  .strict()
  .superRefine((condition, ctx) => {
    if (!RULE_OPERATORS_BY_FIELD[condition.field].includes(condition.operator)) {
      ctx.addIssue({
        code: 'custom',
        path: ['operator'],
        message: 'That comparison does not fit this field',
      });
    }
    if (condition.field === 'price' && !/^\d+(\.\d{1,2})?$/.test(condition.value)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a price such as 5000' });
    }
    if (condition.field === 'category' && !z.uuid().safeParse(condition.value).success) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Choose a category' });
    }
    if (condition.field === 'fit' && !['slim', 'regular', 'relaxed'].includes(condition.value)) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Choose slim, regular or relaxed' });
    }
  });

export const collectionRulesSchema = z
  .object({ match: z.enum(['all', 'any']), conditions: z.array(ruleConditionSchema).max(10) })
  .strict();

const collectionFields = {
  title: requiredText(100, 'Title'),
  slug: optionalSlug,
  description: text(2000),
  type: z.enum(COLLECTION_TYPES),
  rules: collectionRulesSchema,
  sortOrder: z.enum(COLLECTION_SORTS),
  /** ISO timestamp or null. Null = draft, a future time = scheduled. */
  publishedAt: z
    .string()
    .nullable()
    .transform((v) => (v === null || v.trim() === '' ? null : v.trim()))
    .pipe(z.iso.datetime({ offset: true }).nullable()),
  isFeatured: z.boolean(),
  ...seoFields,
};

function collectionRefinement(
  collection: { type: string; rules: { conditions: unknown[] } },
  ctx: z.RefinementCtx,
): void {
  if (collection.type === 'automatic' && collection.rules.conditions.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['rules'],
      message: 'Add at least one rule to an automatic collection',
    });
  }
}

export const createCollectionSchema = z
  .object(collectionFields)
  .strict()
  .superRefine(collectionRefinement);
export const updateCollectionSchema = z
  .object({ id, ...collectionFields })
  .strict()
  .superRefine(collectionRefinement);
export const deleteCollectionSchema = z.object({ id }).strict();
export const previewRulesSchema = z.object({ rules: collectionRulesSchema }).strict();
export const refreshCollectionSchema = z.object({ id }).strict();
export const addCollectionProductsSchema = z
  .object({ collectionId: id, productIds: z.array(id).min(1).max(100) })
  .strict();
export const removeCollectionProductSchema = z.object({ collectionId: id, productId: id }).strict();
export const reorderCollectionProductsSchema = z
  .object({ collectionId: id, orderedProductIds: z.array(id).min(1).max(500) })
  .strict();
export const uploadCollectionHeroFieldsSchema = z
  .object({ collectionId: id, alt: altTextSchema })
  .strict();
export const searchPickerSchema = z
  .object({ q: z.string().trim().min(1).max(80), excludeIds: z.array(id).max(500) })
  .strict();
export const removeCollectionHeroSchema = z.object({ collectionId: id }).strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
