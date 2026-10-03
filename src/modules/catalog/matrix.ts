/**
 * Variant matrix: the cartesian product of a product's option values, and the reconciliation of a
 * newly requested matrix with the variants that already exist. Pure, so it is unit tested without
 * a database. The service applies the plan inside one transaction.
 */

export interface MatrixOptionValue {
  value: string;
  label: string;
}

export interface MatrixOption {
  name: string;
  values: MatrixOptionValue[];
}

export interface MatrixCombination {
  /** Option value ids/values in option order, e.g. ['navy', 'm'] */
  values: string[];
  /** Same order, human labels: ['Navy', 'M'] */
  labels: string[];
}

/** All combinations, first option varying slowest (Color then Size: navy-S, navy-M, ...). */
export function combinations(options: readonly MatrixOption[]): MatrixCombination[] {
  if (options.length === 0) return [];
  let result: MatrixCombination[] = [{ values: [], labels: [] }];
  for (const option of options) {
    const next: MatrixCombination[] = [];
    for (const partial of result) {
      for (const value of option.values) {
        next.push({
          values: [...partial.values, value.value],
          labels: [...partial.labels, value.label],
        });
      }
    }
    result = next;
  }
  return result;
}

export const MAX_VARIANTS = 250;

export const combinationKey = (values: readonly string[]): string => values.join('\u0001');

/** "Oxford Shirt" + [navy, m] -> "OXF-NAV-M". Uppercase, 3 letters per word part, digits kept. */
export function skuFor(prefix: string, values: readonly string[]): string {
  const clean = (text: string, max: number) =>
    text
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9]+/g, '')
      .toUpperCase()
      .slice(0, max);
  return [clean(prefix, 8), ...values.map((v) => clean(v, 4))].filter(Boolean).join('-');
}

export interface ExistingVariant {
  id: string;
  /** Option value (not id) per option, in option order. */
  values: string[];
}

export interface MatrixPlan {
  /** Combinations that need a new variant. */
  create: MatrixCombination[];
  /** Existing variants whose combination is still wanted: left untouched. */
  keep: string[];
  /** Existing variants whose combination is gone: deleted, or archived when referenced. */
  remove: string[];
}

export function planMatrix(
  options: readonly MatrixOption[],
  existing: readonly ExistingVariant[],
): MatrixPlan {
  // A product without options has exactly one (default) variant.
  const wanted: MatrixCombination[] =
    options.length === 0 ? [{ values: [], labels: [] }] : combinations(options);
  const wantedKeys = new Set(wanted.map((c) => combinationKey(c.values)));
  const existingKeys = new Set(existing.map((v) => combinationKey(v.values)));
  const keep: string[] = [];
  const remove: string[] = [];
  const kept = new Set<string>();
  for (const variant of existing) {
    const key = combinationKey(variant.values);
    // The first variant of a combination stays; a duplicate of the same combination goes.
    if (wantedKeys.has(key) && !kept.has(key)) {
      kept.add(key);
      keep.push(variant.id);
    } else {
      remove.push(variant.id);
    }
  }
  return {
    create: wanted.filter((c) => !existingKeys.has(combinationKey(c.values))),
    keep,
    remove,
  };
}

/** Value that makes a variant's SKU unique when the preferred one is taken: -2, -3 ... */
export function dedupeSku(sku: string, taken: ReadonlySet<string>): string {
  if (!taken.has(sku)) return sku;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${sku}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('could not find a free SKU');
}
