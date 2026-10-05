import { describe, expect, it } from 'vitest';
import { isDomainError } from '@/lib/errors';
import { money } from '@/lib/money';
import { DEFAULT_COD_SETTINGS } from '@/modules/settings/schemas';
import { codProvider } from '../cod';
import {
  assertMethodAllowed,
  getPaymentProvider,
  listMethods,
  registeredProviderIds,
} from '../registry';

const bdt = (minor: bigint) => money(minor, 'BDT');
const context = (overrides: Partial<Parameters<typeof codProvider.checkEligibility>[0]> = {}) => ({
  total: bdt(250000n),
  deliveryAllowsCod: true,
  cod: DEFAULT_COD_SETTINGS,
  ...overrides,
});

describe('cash on delivery (5.2)', () => {
  it('is available for an ordinary order', () => {
    expect(codProvider.checkEligibility(context())).toEqual({ available: true });
  });

  it('is allowed exactly at the maximum and refused one poisha above', () => {
    const cod = { enabled: true, maxOrderMinor: '5000000' };
    expect(codProvider.checkEligibility(context({ total: bdt(5000000n), cod })).available).toBe(
      true,
    );
    const above = codProvider.checkEligibility(context({ total: bdt(5000001n), cod }));
    expect(above).toMatchObject({ available: false });
    expect(above.available === false && above.reason).toContain('up to ৳50,000');
  });

  it('follows a changed maximum', () => {
    const cod = { enabled: true, maxOrderMinor: '300000' };
    expect(codProvider.checkEligibility(context({ total: bdt(300000n), cod })).available).toBe(
      true,
    );
    expect(codProvider.checkEligibility(context({ total: bdt(300001n), cod })).available).toBe(
      false,
    );
  });

  it('is refused when switched off or when the delivery rate does not allow it', () => {
    expect(
      codProvider.checkEligibility(context({ cod: { ...DEFAULT_COD_SETTINGS, enabled: false } })),
    ).toMatchObject({
      available: false,
      reason: 'Cash on delivery is not available right now.',
    });
    expect(codProvider.checkEligibility(context({ deliveryAllowsCod: false }))).toMatchObject({
      available: false,
      reason: 'Cash on delivery is not available for this delivery area.',
    });
  });

  it('plans stock to be committed at placement and nothing paid yet', () => {
    expect(codProvider.plan()).toEqual({
      stock: 'commit_on_place',
      orderPaymentStatus: 'unpaid',
      record: { method: 'cash', status: 'pending' },
    });
  });
});

describe('payment provider registry (5.1)', () => {
  it('registers only cash on delivery until a gateway has a merchant account', () => {
    expect(registeredProviderIds()).toEqual(['cod']);
  });

  it('refuses unknown and unregistered methods, whatever a client sends', () => {
    for (const id of ['sslcommerz', 'stripe', 'bkash', 'paypal', '', '__proto__', 'constructor']) {
      expect(() => getPaymentProvider(id)).toThrow();
      try {
        getPaymentProvider(id);
      } catch (error) {
        expect(isDomainError(error) && error.code).toBe('VALIDATION');
      }
    }
  });

  it('lists methods with the reason when one cannot be used', () => {
    const [cod] = listMethods(context({ deliveryAllowsCod: false }));
    expect(cod).toMatchObject({ id: 'cod', available: false });
    expect(cod?.reason).toBeTruthy();
    expect(listMethods(context())[0]).toMatchObject({ id: 'cod', available: true });
  });

  it('assertMethodAllowed throws the reason and returns the provider otherwise', () => {
    expect(assertMethodAllowed('cod', context()).id).toBe('cod');
    expect(() => assertMethodAllowed('cod', context({ deliveryAllowsCod: false }))).toThrow(
      /not available for this delivery area/,
    );
  });
});
