import { describe, expect, it } from 'vitest';
import {
  applyPriceToAll,
  mapVariantErrors,
  rowsChanged,
  toVariantsPayload,
  validateVariantRows,
  variantTitle,
  type VariantRow,
} from '../variants-logic';

const PRODUCT = '8f14e45f-ceea-4d67-9b1a-2f3b6c9d0a11';
const row = (n: number, change: Partial<VariantRow> = {}): VariantRow => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  labels: ['Navy', `S${n}`],
  sku: `OXF-NAV-${n}`,
  barcode: '',
  price: '2490.00',
  compareAt: '',
  weightG: '',
  status: 'active',
  onHand: 0,
  ...change,
});

describe('variant rows', () => {
  it('builds the exact updateVariants input from the typed text', () => {
    expect(toVariantsPayload(PRODUCT, [row(1)]).variants[0]).toEqual({
      id: row(1).id,
      sku: 'OXF-NAV-1',
      barcode: '',
      price: '2490.00',
      compareAt: '',
      weightG: '',
      status: 'active',
    });
  });

  it('maps server keys onto the right row and cell', () => {
    const mapped = mapVariantErrors({
      'variants.2.sku': ['SKUs must be different', 'second'],
      'variants.0.price': ['Enter a valid amount'],
      'variants.1.nonsense': ['ignored as a cell'],
      _form: ['Some SKUs are repeated.'],
    });
    expect(mapped.rows).toEqual({
      2: { sku: 'SKUs must be different' },
      0: { price: 'Enter a valid amount' },
    });
    expect(mapped.other).toEqual(['ignored as a cell', 'Some SKUs are repeated.']);
  });

  it('validates with the server schema and reports by row index', () => {
    const errors = validateVariantRows(PRODUCT, [row(1), row(2, { sku: '', price: 'abc' })]);
    expect(errors.rows[1]).toMatchObject({ sku: expect.any(String), price: expect.any(String) });
    expect(errors.rows[0]).toBeUndefined();
    expect(validateVariantRows(PRODUCT, [row(1)])).toEqual({ rows: {}, other: [] });
  });

  it('fills the price of every row without touching other fields', () => {
    const next = applyPriceToAll([row(1), row(2, { price: '1' })], '3,000');
    expect(next.map((r) => r.price)).toEqual(['3,000', '3,000']);
    expect(next[1]?.sku).toBe('OXF-NAV-2');
  });

  it('detects edits and names the variant', () => {
    expect(rowsChanged([row(1)], [row(1)])).toBe(false);
    expect(rowsChanged([row(1, { sku: 'X' })], [row(1)])).toBe(true);
    expect(variantTitle(row(1))).toBe('Navy / S1');
    expect(variantTitle({ labels: [''], sku: 'ABC' })).toBe('ABC');
  });
});
