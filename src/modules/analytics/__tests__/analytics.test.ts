import { describe, expect, it } from 'vitest';
import { getDateRangeBounds } from '../repository';
import { analyticsFilterSchema, analyticsRangeSchema } from '../schemas';

describe('analytics module', () => {
  describe('schemas', () => {
    it('accepts valid time ranges', () => {
      expect(analyticsRangeSchema.parse('7d')).toBe('7d');
      expect(analyticsRangeSchema.parse('30d')).toBe('30d');
      expect(analyticsRangeSchema.parse('90d')).toBe('90d');
      expect(analyticsRangeSchema.parse('12m')).toBe('12m');
      expect(analyticsRangeSchema.parse('all')).toBe('all');
    });

    it('defaults to 30d when undefined', () => {
      expect(analyticsRangeSchema.parse(undefined)).toBe('30d');
    });

    it('rejects invalid time ranges', () => {
      expect(() => analyticsRangeSchema.parse('1day')).toThrow();
      expect(() => analyticsRangeSchema.parse('invalid')).toThrow();
    });

    it('validates filter parameters', () => {
      const parsed = analyticsFilterSchema.parse({ range: '7d' });
      expect(parsed.range).toBe('7d');
    });
  });

  describe('getDateRangeBounds', () => {
    it('computes correct delta days for 7d', () => {
      const bounds = getDateRangeBounds('7d');
      const diffDays = Math.round(
        (bounds.end.getTime() - bounds.currentStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(7);

      const prevDiffDays = Math.round(
        (bounds.currentStart.getTime() - bounds.previousStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(prevDiffDays).toBe(7);
    });

    it('computes correct delta days for 30d', () => {
      const bounds = getDateRangeBounds('30d');
      const diffDays = Math.round(
        (bounds.end.getTime() - bounds.currentStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(30);
    });

    it('computes correct delta days for 90d', () => {
      const bounds = getDateRangeBounds('90d');
      const diffDays = Math.round(
        (bounds.end.getTime() - bounds.currentStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(90);
    });

    it('computes correct delta days for 12m', () => {
      const bounds = getDateRangeBounds('12m');
      const diffDays = Math.round(
        (bounds.end.getTime() - bounds.currentStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(365);
    });
  });
});
