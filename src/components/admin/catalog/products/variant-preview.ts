import { MAX_VARIANTS, planMatrix, type MatrixOption } from '@/modules/catalog/matrix';
import type { ProductView } from './types';
import { moneyText } from '@/modules/catalog/schemas';
import { slugify } from '@/modules/catalog/slug';

export const MAX_OPTIONS = 3;
export const MAX_VALUES_PER_OPTION = 30;
export const OPTION_SUGGESTIONS = ['Color', 'Size', 'Fit'] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface DraftValue {
  key: string;
  label: string;
  /** Empty, or a colour such as #RRGGBB. */
  swatchHex: string;
}

export interface DraftOption {
  key: string;
  name: string;
  values: DraftValue[];
}

export interface MatrixPreview {
  /** Size of the matrix after this change (0 when it cannot be built). */
  total: number;
  create: number;
  keep: number;
  /** Variants whose combination is gone: removed, or archived when they have stock history. */
  remove: number;
  /** Reasons the matrix cannot be generated yet. */
  problems: string[];
}

export const isColourOption = (name: string): boolean => /^colou?rs?$/i.test(name.trim());

/** A fresh draft from the product's saved options, in saved order. */
export function draftFromProduct(options: ProductView['options']): DraftOption[] {
  return options.map((option) => ({
    key: option.id,
    name: option.name,
    values: option.values.map((value) => ({
      key: value.id,
      label: value.label,
      swatchHex: value.swatchHex ?? '',
    })),
  }));
}

/** The saved option and values a draft option stands for, as the server will match them. */
export interface ResolvedOption {
  /** Saved option id, or null for a new option. */
  optionId: string | null;
  /** Saved value id per draft value (same order), or null for a new value. */
  valueIds: Array<string | null>;
}

/**
 * Which saved rows each draft option and value keeps. A draft that still carries the id of a saved
 * option or value keeps it through a rename; one without an id is matched by name (options) or by
 * slug (values), exactly like the server, so a typo fix never recreates a variant.
 */
export function resolveDraft(
  draft: readonly DraftOption[],
  saved: Pick<ProductView, 'options'>['options'],
): ResolvedOption[] {
  return draft.map((option) => {
    const bySavedId = saved.find((o) => o.id === option.key);
    const found = bySavedId ?? saved.find((o) => o.name === option.name.trim());
    return {
      optionId: found?.id ?? null,
      valueIds: option.values.map((value) => {
        if (!found) return null;
        const byId = found.values.find((v) => v.id === value.key);
        return (
          (byId ?? found.values.find((v) => v.value === slugify(value.label.trim())))?.id ?? null
        );
      }),
    };
  });
}

/**
 * What generating this matrix would do to the product's variants, worked out the way the server
 * does it: options and values keep their id through a rename (otherwise options match by name and
 * values by slug), and a variant whose combination is not in the new matrix is removed. Pure, so the person sees the counts before anything changes.
 */
export function previewMatrix(
  draft: readonly DraftOption[],
  product: Pick<ProductView, 'options' | 'variants'>,
): MatrixPreview {
  const problems: string[] = [];

  const resolved = resolveDraft(draft, product.options);
  const names = new Set<string>();
  const options: MatrixOption[] = draft.map((option, optionIndex) => {
    const name = option.name.trim();
    if (!name) problems.push('Every option needs a name.');
    else if (names.has(name.toLowerCase())) problems.push(`The option ${name} is listed twice.`);
    names.add(name.toLowerCase());
    if (option.values.length === 0) {
      problems.push(`${name || 'An option'} needs at least one value.`);
    }
    const seen = new Set<string>();
    const values = option.values.map((v, valueIndex) => {
      const label = v.label.trim();
      const slug = slugify(label);
      // A value that keeps a saved row is identified by that row; a new one by its slug.
      const value = resolved[optionIndex]!.valueIds[valueIndex] ?? `new:${slug}`;
      if (!slug) problems.push(`${name || 'An option'} has a value without letters or numbers.`);
      else if (seen.has(slug)) problems.push(`${name || 'An option'} lists ${label} twice.`);
      seen.add(slug);
      if (v.swatchHex && !HEX.test(v.swatchHex)) {
        problems.push(`The colour for ${label} must look like #RRGGBB.`);
      }
      return { label, value };
    });
    return { name, values };
  });

  // No options means one default variant (a wallet, a belt without sizes).
  const total = options.reduce((n, o) => n * o.values.length, 1);
  if (total > MAX_VARIANTS) {
    problems.push(`That makes ${total} variants. The limit is ${MAX_VARIANTS}.`);
  }
  if (problems.length > 0) return { total, create: 0, keep: 0, remove: 0, problems };

  const existing = product.variants.map((variant) => {
    const ids = new Set(variant.optionValueIds);
    const values = resolved.map((option) => {
      const saved = product.options.find((o) => o.id === option.optionId);
      return saved?.values.find((value) => ids.has(value.id))?.id ?? '';
    });
    return { id: variant.id, values };
  });
  const complete = existing.filter((v) => v.values.every(Boolean));
  const mismatched = existing.length - complete.length;
  const plan = planMatrix(options, complete);
  return {
    total,
    create: plan.create.length,
    keep: plan.keep.length,
    remove: plan.remove.length + mismatched,
    problems,
  };
}

/** The sentence under the matrix: what is about to happen, in plain words. */
export function describePreview(preview: MatrixPreview): string {
  if (preview.problems.length > 0) return 'This matrix cannot be generated yet.';
  const n = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  return `${n(preview.create, 'variant')} will be created, ${preview.keep} kept, ${preview.remove} removed.`;
}

/** Amount text as typed ("2490", "2,490.50"). Never converted to a number here. */
export const isMoneyText = (text: string): boolean => moneyText.safeParse(text).success;

export function nextOptionName(draft: readonly DraftOption[]): string {
  const used = new Set(draft.map((o) => o.name.trim().toLowerCase()));
  return OPTION_SUGGESTIONS.find((name) => !used.has(name.toLowerCase())) ?? '';
}
