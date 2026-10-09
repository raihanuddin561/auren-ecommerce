import { describe, expect, it } from 'vitest';
import { evaluateDiscount, GENERIC_COUPON_ERROR, isLineEligible } from '../service';
import type { DiscountRecord, LineForDiscount } from '../types';

const baseDiscount: DiscountRecord = {
  id: '00000000-0000-0000-0000-000000000001',
  code: 'SUMMER15',
  title: 'Summer 15% Off',
  type: 'percentage',
  value: 15, // 15%
  appliesTo: 'order',
  targetIds: [],
  minSubtotalMinor: null,
  minQuantity: null,
  maxDiscountMinor: null,
  customerEligibility: 'all',
  usageLimit: 100,
  usageLimitPerCustomer: 1,
  usageCount: 5,
  combinable: false,
  startsAt: new Date(Date.now() - 86400000), // 1 day ago
  endsAt: new Date(Date.now() + 86400000), // tomorrow
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleLines: LineForDiscount[] = [
  {
    variantId: 'var-1',
    productId: 'prod-1',
    categoryId: 'cat-1',
    unitPriceMinor: 200000n, // 2,000 BDT
    quantity: 1,
    currency: 'BDT',
  },
  {
    variantId: 'var-2',
    productId: 'prod-2',
    categoryId: 'cat-2',
    unitPriceMinor: 300000n, // 3,000 BDT
    quantity: 1,
    currency: 'BDT',
  },
];

describe('10.1 & 10.2 Discount Engine', () => {
  it('calculates percentage discount accurately across order subtotal', async () => {
    // Subtotal: 5,000 BDT = 500,000 poisha. 15% of 500,000 = 75,000 poisha (750 BDT).
    const evaluated = await evaluateDiscount(baseDiscount, sampleLines);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.discountMinor).toBe(75000n);
    expect(evaluated!.freeShipping).toBe(false);

    // Sum of allocated line discounts must equal total discount minor (INV-M4)
    const sumLineDiscounts = evaluated!.lines.reduce((acc, l) => acc + l.discountMinor, 0n);
    expect(sumLineDiscounts).toBe(75000n);

    // Line 1 (2,000 / 5,000 = 40%): 40% of 75,000 = 30,000
    // Line 2 (3,000 / 5,000 = 60%): 60% of 75,000 = 45,000
    const line1 = evaluated!.lines.find((l) => l.variantId === 'var-1')!;
    const line2 = evaluated!.lines.find((l) => l.variantId === 'var-2')!;
    expect(line1.discountMinor).toBe(30000n);
    expect(line2.discountMinor).toBe(45000n);
    expect(line1.totalMinor).toBe(170000n); // 200,000 - 30,000
    expect(line2.totalMinor).toBe(255000n); // 300,000 - 45,000
  });

  it('respects max discount cap for percentage discounts', async () => {
    const cappedDiscount: DiscountRecord = {
      ...baseDiscount,
      value: 20, // 20% of 5,000 BDT = 1,000 BDT (100,000 poisha)
      maxDiscountMinor: 60000n, // capped at 600 BDT (60,000 poisha)
    };

    const evaluated = await evaluateDiscount(cappedDiscount, sampleLines);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.discountMinor).toBe(60000n);
  });

  it('calculates fixed amount discount and caps at eligible subtotal', async () => {
    const fixedDiscount: DiscountRecord = {
      ...baseDiscount,
      type: 'fixed_amount',
      value: 500, // 500 BDT = 50,000 poisha
    };

    const evaluated = await evaluateDiscount(fixedDiscount, sampleLines);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.discountMinor).toBe(50000n);

    // If discount exceeds subtotal, cap at subtotal
    const giantDiscount: DiscountRecord = {
      ...fixedDiscount,
      value: 10000, // 10,000 BDT > 5,000 BDT
    };

    const cappedEvaluated = await evaluateDiscount(giantDiscount, sampleLines);
    expect(cappedEvaluated!.discountMinor).toBe(500000n); // capped at full subtotal
  });

  it('evaluates free shipping discounts', async () => {
    const freeShippingDiscount: DiscountRecord = {
      ...baseDiscount,
      type: 'free_shipping',
      value: 0,
    };

    const evaluated = await evaluateDiscount(freeShippingDiscount, sampleLines, {
      shippingChargeMinor: 12000n,
    });

    expect(evaluated).not.toBeNull();
    expect(evaluated!.freeShipping).toBe(true);
    expect(evaluated!.discountMinor).toBe(12000n);
  });

  it('refuses expired or inactive discounts', async () => {
    const inactiveDiscount: DiscountRecord = {
      ...baseDiscount,
      isActive: false,
    };
    expect(await evaluateDiscount(inactiveDiscount, sampleLines)).toBeNull();

    const expiredDiscount: DiscountRecord = {
      ...baseDiscount,
      endsAt: new Date(Date.now() - 3600000), // 1 hour ago
    };
    expect(await evaluateDiscount(expiredDiscount, sampleLines)).toBeNull();

    const futureDiscount: DiscountRecord = {
      ...baseDiscount,
      startsAt: new Date(Date.now() + 3600000), // in 1 hour
    };
    expect(await evaluateDiscount(futureDiscount, sampleLines)).toBeNull();
  });

  it('enforces minimum order subtotal requirement', async () => {
    const minSubtotalDiscount: DiscountRecord = {
      ...baseDiscount,
      minSubtotalMinor: 600000n, // 6,000 BDT required; lines are 5,000 BDT
    };

    const evaluated = await evaluateDiscount(minSubtotalDiscount, sampleLines);
    expect(evaluated).toBeNull();
  });

  it('enforces minimum quantity requirement', async () => {
    const minQtyDiscount: DiscountRecord = {
      ...baseDiscount,
      minQuantity: 3, // 3 items required; sampleLines has 2
    };

    const evaluated = await evaluateDiscount(minQtyDiscount, sampleLines);
    expect(evaluated).toBeNull();
  });

  it('restricts discount to targeted products or categories', async () => {
    const productTargetedDiscount: DiscountRecord = {
      ...baseDiscount,
      appliesTo: 'products',
      targetIds: ['prod-1'], // only prod-1 (2,000 BDT)
    };

    // 15% of 2,000 BDT = 300 BDT (30,000 poisha)
    const evaluated = await evaluateDiscount(productTargetedDiscount, sampleLines);
    expect(evaluated).not.toBeNull();
    expect(evaluated!.discountMinor).toBe(30000n);

    const line1 = evaluated!.lines.find((l) => l.variantId === 'var-1')!;
    const line2 = evaluated!.lines.find((l) => l.variantId === 'var-2')!;
    expect(line1.discountMinor).toBe(30000n);
    expect(line2.discountMinor).toBe(0n); // ineligible product gets 0 discount
  });

  it('correctly tests line eligibility with isLineEligible', () => {
    expect(isLineEligible(baseDiscount, sampleLines[0]!)).toBe(true);

    const productDiscount: DiscountRecord = {
      ...baseDiscount,
      appliesTo: 'products',
      targetIds: ['prod-1'],
    };
    expect(isLineEligible(productDiscount, sampleLines[0]!)).toBe(true);
    expect(isLineEligible(productDiscount, sampleLines[1]!)).toBe(false);
  });

  it('uses generic message for invalid or expired codes to prevent enumeration', () => {
    expect(GENERIC_COUPON_ERROR).toBe('Invalid or expired discount code');
  });
});
