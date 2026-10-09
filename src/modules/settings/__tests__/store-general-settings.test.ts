import { describe, expect, it } from 'vitest';
import { DEFAULT_STORE_GENERAL_SETTINGS, storeGeneralSettingsSchema } from '../schemas';

describe('15.3 Store General Settings', () => {
  it('provides comprehensive default store configuration', () => {
    expect(DEFAULT_STORE_GENERAL_SETTINGS.storeName).toBe('AUREN');
    expect(DEFAULT_STORE_GENERAL_SETTINGS.currency).toBe('BDT');
    expect(DEFAULT_STORE_GENERAL_SETTINGS.timezone).toBe('Asia/Dhaka');
    expect(DEFAULT_STORE_GENERAL_SETTINGS.pricesIncludeVat).toBe(true);
    expect(DEFAULT_STORE_GENERAL_SETTINGS.vatPercentage).toBe(5);
  });

  it('validates correct store input data', () => {
    const valid = {
      storeName: 'Auren Maison',
      tagline: 'Timeless Luxury Tailoring',
      supportEmail: 'care@auren.com',
      supportPhone: '+880 1711-223344',
      whatsappNumber: '+880 1711-223344',
      address: 'Gulshan 2, Dhaka, Bangladesh',
      binNumber: '009876543-0202',
      vatPercentage: 7.5,
      pricesIncludeVat: true,
      currency: 'BDT' as const,
      timezone: 'Asia/Dhaka' as const,
      socialInstagram: 'https://instagram.com/auren.maison',
      socialFacebook: 'https://facebook.com/auren.maison',
      socialYoutube: '',
    };

    const parsed = storeGeneralSettingsSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.storeName).toBe('Auren Maison');
      expect(parsed.data.vatPercentage).toBe(7.5);
    }
  });

  it('rejects invalid email and negative VAT rates', () => {
    const invalidEmail = {
      ...DEFAULT_STORE_GENERAL_SETTINGS,
      supportEmail: 'not-an-email',
    };
    expect(storeGeneralSettingsSchema.safeParse(invalidEmail).success).toBe(false);

    const negativeVat = {
      ...DEFAULT_STORE_GENERAL_SETTINGS,
      vatPercentage: -5,
    };
    expect(storeGeneralSettingsSchema.safeParse(negativeVat).success).toBe(false);
  });

  it('rejects empty store name', () => {
    const emptyName = {
      ...DEFAULT_STORE_GENERAL_SETTINGS,
      storeName: '   ',
    };
    expect(storeGeneralSettingsSchema.safeParse(emptyName).success).toBe(false);
  });
});
