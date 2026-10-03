import { productDetailsSchema } from '@/modules/catalog/schemas';
import type { ProductView } from './types';
import type { FieldErrorMap } from '../../action-feedback';
import type { SaveStatus } from '../../form-section';
import { fromSelect, toSelect } from './select-value';

/** Every field of the details form as the person sees it: strings, never null. */
export interface DetailsValues {
  title: string;
  subtitle: string;
  slug: string;
  description: string;
  categoryId: string;
  sizeChartId: string;
  productType: string;
  fit: string;
  material: string;
  careInstructions: string;
  origin: string;
  tags: string[];
  fabric: string;
  occasion: string;
  season: string;
  pattern: string;
  featuredRank: string;
  seoTitle: string;
  seoDescription: string;
}

export const MAX_TAGS = 20;

export function valuesFromProduct(product: ProductView): DetailsValues {
  return {
    title: product.title,
    subtitle: product.subtitle ?? '',
    slug: product.slug,
    description: product.description ?? '',
    categoryId: toSelect(product.categoryId),
    sizeChartId: toSelect(product.sizeChartId),
    productType: product.productType ?? '',
    fit: toSelect(product.fit),
    material: product.material ?? '',
    careInstructions: product.careInstructions ?? '',
    origin: product.origin ?? '',
    tags: product.tags,
    fabric: product.attributes.fabric,
    occasion: product.attributes.occasion,
    season: product.attributes.season,
    pattern: product.attributes.pattern,
    featuredRank: product.featuredRank === null ? '' : String(product.featuredRank),
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
  };
}

/** The exact object updateProductDetails takes. Blank strings are fine: the schema nulls them. */
export function toDetailsPayload(id: string, v: DetailsValues) {
  return {
    id,
    title: v.title,
    subtitle: v.subtitle,
    description: v.description,
    slug: v.slug,
    categoryId: fromSelect(v.categoryId),
    sizeChartId: fromSelect(v.sizeChartId),
    productType: v.productType,
    material: v.material,
    careInstructions: v.careInstructions,
    fit: fromSelect(v.fit),
    origin: v.origin,
    tags: v.tags,
    attributes: {
      fabric: v.fabric,
      occasion: v.occasion,
      season: v.season,
      pattern: v.pattern,
    },
    featuredRank: v.featuredRank,
    seoTitle: v.seoTitle,
    seoDescription: v.seoDescription,
  };
}

/** Server-style field keys to the form's own field names (attributes.fabric -> fabric). */
export function formKey(path: string): string {
  return path.startsWith('attributes.') ? path.slice('attributes.'.length) : path;
}

/** Validates with the same schema the server uses, so a form that passes here is accepted there. */
export function validateDetails(id: string, values: DetailsValues): FieldErrorMap {
  const parsed = productDetailsSchema.safeParse(toDetailsPayload(id, values));
  if (parsed.success) return {};
  const errors: FieldErrorMap = {};
  for (const issue of parsed.error.issues) {
    // Tag problems are reported on the tags field, not on one array position.
    const key = issue.path[0] === 'tags' ? 'tags' : formKey(issue.path.join('.') || '_form');
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

/** A stable text key for change detection. */
export const detailsKey = (values: DetailsValues): string => JSON.stringify(values);

export interface AutosaveInput {
  /** Drafts autosave; active and archived products use the Save button only. */
  enabled: boolean;
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  /** The values that last failed to save: not retried until the person changes something. */
  failedKey: string | null;
  currentKey: string;
}

/** Whether the debounce timer should be running for the current form state. */
export function shouldAutosave(input: AutosaveInput): boolean {
  return (
    input.enabled &&
    input.dirty &&
    input.valid &&
    !input.saving &&
    input.failedKey !== input.currentKey
  );
}

export const AUTOSAVE_DELAY_MS = 1500;

export function saveStatusOf(input: {
  dirty: boolean;
  saving: boolean;
  failedKey: string | null;
  currentKey: string;
}): SaveStatus {
  if (input.saving) return 'saving';
  if (input.failedKey !== null && input.failedKey === input.currentKey) return 'error';
  return input.dirty ? 'dirty' : 'saved';
}

export type TagResult = { tags: string[]; error: string | null };

/** Adds the typed tags (comma separated) to the list: lowercase, trimmed, no duplicates, up to 20. */
export function addTags(current: readonly string[], raw: string): TagResult {
  const tags = [...current];
  let error: string | null = null;
  for (const piece of raw.split(',')) {
    const tag = piece.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!tag) continue;
    if (tag.length > 40) {
      error = 'A tag can have up to 40 characters';
      continue;
    }
    if (!/^[a-z0-9][a-z0-9 -]*$/.test(tag)) {
      error = 'Tags use letters, numbers, spaces and hyphens';
      continue;
    }
    if (tags.includes(tag)) continue;
    if (tags.length >= MAX_TAGS) {
      error = `A product can have up to ${MAX_TAGS} tags`;
      break;
    }
    tags.push(tag);
  }
  return { tags, error };
}
