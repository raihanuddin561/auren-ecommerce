import { describe, expect, it } from 'vitest';
import { searchInputSchema, suggestionsInputSchema } from '../schemas';
import { POPULAR_SEARCHES } from '../service';

describe('search schemas', () => {
  describe('searchInputSchema', () => {
    it('validates and trims valid queries', () => {
      const result = searchInputSchema.safeParse({ q: '  linen shirt  ', limit: 20 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('linen shirt');
        expect(result.data.limit).toBe(20);
      }
    });

    it('applies default limit when omitted', () => {
      const result = searchInputSchema.safeParse({ q: 'trousers' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(24);
      }
    });

    it('rejects query that exceeds maximum length', () => {
      const result = searchInputSchema.safeParse({ q: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('rejects unknown fields under strict mode', () => {
      const result = searchInputSchema.safeParse({ q: 'silk', extra: true });
      expect(result.success).toBe(false);
    });
  });

  describe('suggestionsInputSchema', () => {
    it('accepts short queries for suggestions', () => {
      const result = suggestionsInputSchema.safeParse({ q: 'sh' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('sh');
      }
    });

    it('trims whitespace', () => {
      const result = suggestionsInputSchema.safeParse({ q: '  polo  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('polo');
      }
    });
  });

  describe('popular searches', () => {
    it('provides high-luxury menswear terms', () => {
      expect(POPULAR_SEARCHES.length).toBeGreaterThanOrEqual(4);
      expect(POPULAR_SEARCHES).toContain('Linen Shirt');
      expect(POPULAR_SEARCHES).toContain('Pleated Trousers');
    });
  });
});
