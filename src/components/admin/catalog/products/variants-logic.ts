import type { ProductView } from './types';
import { updateVariantsSchema } from '@/modules/catalog/schemas';

export type VariantStatus = ProductView['variants'][number]['status'];

/** One editable row. Every field is the text a person types; nothing is converted to a number. */
export interface VariantRow {
  id: string;
  /** Option labels in option order, for example ['Navy', 'M']. */
  labels: string[];
  sku: string;
  barcode: string;
  price: string;
  compareAt: string;
  weightG: string;
  status: VariantStatus;
  onHand: number;
}

export type EditableField = 'sku' | 'barcode' | 'price' | 'compareAt' | 'weightG' | 'status';

/** Messages per row index, then per field. */
export type RowErrors = Record<number, Partial<Record<EditableField, string>>>;

export function rowsFromProduct(variants: ProductView['variants']): VariantRow[] {
  return variants.map((v) => ({
    id: v.id,
    labels: v.labels,
    sku: v.sku,
    barcode: v.barcode ?? '',
    price: v.price,
    compareAt: v.compareAt,
    weightG: v.weightG === null ? '' : String(v.weightG),
    status: v.status,
    onHand: v.onHand,
  }));
}

/** The exact input of updateVariants. */
export function toVariantsPayload(productId: string, rows: readonly VariantRow[]) {
  return {
    productId,
    variants: rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      barcode: r.barcode,
      price: r.price,
      compareAt: r.compareAt,
      weightG: r.weightG,
      status: r.status,
    })),
  };
}

const FIELDS: readonly EditableField[] = [
  'sku',
  'barcode',
  'price',
  'compareAt',
  'weightG',
  'status',
];

/** Turns server style keys ("variants.2.sku") into messages on the right row and cell. */
export function mapVariantErrors(fieldErrors: Record<string, string[]>): {
  rows: RowErrors;
  other: string[];
} {
  const rows: RowErrors = {};
  const other: string[] = [];
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const match = /^variants\.(\d+)\.(\w+)$/.exec(key);
    const field = match?.[2] as EditableField | undefined;
    if (match && field && FIELDS.includes(field)) {
      const index = Number(match[1]);
      (rows[index] ??= {})[field] ??= messages[0];
    } else {
      other.push(...messages);
    }
  }
  return { rows, other };
}

/** Checks the rows with the server's own schema, so a save that passes here is accepted there. */
export function validateVariantRows(
  productId: string,
  rows: readonly VariantRow[],
): ReturnType<typeof mapVariantErrors> {
  const parsed = updateVariantsSchema.safeParse(toVariantsPayload(productId, rows));
  if (parsed.success) return { rows: {}, other: [] };
  const grouped: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    (grouped[issue.path.join('.')] ??= []).push(issue.message);
  }
  return mapVariantErrors(grouped);
}

/** Fills the price of every row (client only: nothing is saved until Save variants). */
export function applyPriceToAll(rows: readonly VariantRow[], price: string): VariantRow[] {
  return rows.map((row) => ({ ...row, price }));
}

export function rowsChanged(rows: readonly VariantRow[], baseline: readonly VariantRow[]): boolean {
  return JSON.stringify(rows) !== JSON.stringify(baseline);
}

export const variantTitle = (row: Pick<VariantRow, 'labels' | 'sku'>): string =>
  row.labels.filter(Boolean).join(' / ') || row.sku;
