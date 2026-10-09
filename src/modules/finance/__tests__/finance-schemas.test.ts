import { describe, expect, it } from 'vitest';
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  createMarketingCampaignSchema,
  createRecurringExpenseSchema,
  expenseFilterSchema,
  pAndLFilterSchema,
} from '../schemas';

describe('Finance module schemas (Module 11)', () => {
  describe('createExpenseCategorySchema (11.1)', () => {
    it('accepts valid category input', () => {
      const res = createExpenseCategorySchema.safeParse({
        name: 'Digital Advertising',
        type: 'marketing',
        isCogs: false,
        description: 'Meta and Google campaigns',
      });
      expect(res.success).toBe(true);
    });

    it('rejects short or empty names', () => {
      const res = createExpenseCategorySchema.safeParse({
        name: 'a',
        type: 'rent',
      });
      expect(res.success).toBe(false);
    });

    it('rejects unknown category types', () => {
      const res = createExpenseCategorySchema.safeParse({
        name: 'Custom',
        type: 'unknown_type',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('createMarketingCampaignSchema (11.4)', () => {
    it('accepts valid campaign input', () => {
      const res = createMarketingCampaignSchema.safeParse({
        name: 'Autumn Linen 2026',
        channel: 'meta',
        utmCampaign: 'autumn_linen_2026',
        startsOn: '2026-10-01',
        endsOn: '2026-10-31',
        budgetMinor: 5000000n,
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const res = createMarketingCampaignSchema.safeParse({
        name: 'Campaign',
        channel: 'google',
        startsOn: '10/01/2026',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('createRecurringExpenseSchema (11.3)', () => {
    it('accepts valid recurring expense schedule', () => {
      const res = createRecurringExpenseSchema.safeParse({
        categoryId: '01927364-0001-7000-8000-000000000001',
        vendor: 'Banani Studio Holdings',
        amountMinor: 12000000n,
        currency: 'BDT',
        cadence: 'monthly',
        dayOfPeriod: 1,
        startsOn: '2026-01-01',
        isActive: true,
      });
      expect(res.success).toBe(true);
    });

    it('rejects zero or negative amount', () => {
      const res = createRecurringExpenseSchema.safeParse({
        categoryId: '01927364-0001-7000-8000-000000000001',
        vendor: 'Vendor',
        amountMinor: 0n,
        startsOn: '2026-01-01',
      });
      expect(res.success).toBe(false);
    });

    it('rejects dayOfPeriod outside 1-31', () => {
      const res = createRecurringExpenseSchema.safeParse({
        categoryId: '01927364-0001-7000-8000-000000000001',
        vendor: 'Vendor',
        amountMinor: 1000n,
        startsOn: '2026-01-01',
        dayOfPeriod: 32,
      });
      expect(res.success).toBe(false);
    });
  });

  describe('createExpenseSchema (11.2)', () => {
    it('accepts valid expense entry', () => {
      const res = createExpenseSchema.safeParse({
        expenseDate: '2026-10-09',
        categoryId: '01927364-0001-7000-8000-000000000001',
        vendor: 'Italian Fabric Mills',
        description: '20 meters pure wool cloth',
        amountMinor: 4500000n,
        currency: 'BDT',
        paymentMethod: 'bank_transfer',
        reference: 'INV-9921',
      });
      expect(res.success).toBe(true);
    });

    it('rejects non-positive amount', () => {
      const res = createExpenseSchema.safeParse({
        expenseDate: '2026-10-09',
        categoryId: '01927364-0001-7000-8000-000000000001',
        vendor: 'Vendor',
        description: 'Testing',
        amountMinor: -500n,
      });
      expect(res.success).toBe(false);
    });
  });

  describe('pAndLFilterSchema (11.8)', () => {
    it('defaults to delivered recognition mode and month grouping', () => {
      const parsed = pAndLFilterSchema.parse({});
      expect(parsed.recognitionMode).toBe('delivered');
      expect(parsed.grouping).toBe('month');
    });

    it('accepts custom date filters and placed mode', () => {
      const parsed = pAndLFilterSchema.parse({
        recognitionMode: 'placed',
        from: '2026-09-01',
        to: '2026-09-30',
        grouping: 'day',
      });
      expect(parsed.recognitionMode).toBe('placed');
      expect(parsed.from).toBe('2026-09-01');
      expect(parsed.grouping).toBe('day');
    });
  });

  describe('expenseFilterSchema', () => {
    it('applies defaults correctly', () => {
      const parsed = expenseFilterSchema.parse({});
      expect(parsed.limit).toBe(25);
    });
  });
});
