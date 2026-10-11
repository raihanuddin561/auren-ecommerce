import { describe, expect, it } from 'vitest';
import { DICTIONARIES, getDictionary } from '../dictionary';
import { translateLabel, NAV_TRANSLATIONS } from '../context';
import { storeGeneralSettingsSchema } from '@/modules/settings/schemas';

describe('i18n Localization Engine', () => {
  it('has consistent structures between English and Bangla dictionaries', () => {
    const en = DICTIONARIES.en;
    const bn = DICTIONARIES.bn;

    expect(en.locale).toBe('en');
    expect(bn.locale).toBe('bn');

    // Common keys
    expect(Object.keys(en.common)).toEqual(Object.keys(bn.common));
    // Nav keys
    expect(Object.keys(en.nav)).toEqual(Object.keys(bn.nav));
    // Header keys
    expect(Object.keys(en.header)).toEqual(Object.keys(bn.header));
    // Product keys
    expect(Object.keys(en.product)).toEqual(Object.keys(bn.product));
    // Cart keys
    expect(Object.keys(en.cart)).toEqual(Object.keys(bn.cart));
    // Footer keys
    expect(Object.keys(en.footer)).toEqual(Object.keys(bn.footer));

    // Announcements
    expect(en.announcements.length).toBe(3);
    expect(bn.announcements.length).toBe(3);
  });

  it('provides natural quiet-luxury Bengali translations', () => {
    const bn = getDictionary('bn');
    expect(bn.cart.yourBag).toBe('আপনার ব্যাগ');
    expect(bn.cart.checkout).toBe('চেকআউটে এগিয়ে যান');
    expect(bn.common.explore).toBe('ঘুরে দেখুন');
    expect(bn.header.search).toBe('অনুসন্ধান করুন');
  });

  it('translates nav items properly in Bangla while keeping English intact', () => {
    expect(NAV_TRANSLATIONS.Shop).toBe('কেনাকাটা');
    expect(translateLabel('Shirts', 'en')).toBe('Shirts');
    expect(translateLabel('Shirts', 'bn')).toBe('শার্ট');
    expect(translateLabel('Tailoring', 'bn')).toBe('টেইলরিং');
    expect(translateLabel('Shop', 'bn')).toBe('কেনাকাটা');

    // Dynamic pattern "All <category>"
    expect(translateLabel('All shirts', 'bn')).toBe('সব শার্ট');
    expect(translateLabel('All shirts', 'en')).toBe('All shirts');
  });

  it('supports defaultLanguage in storeGeneralSettingsSchema', () => {
    const defaultParsed = storeGeneralSettingsSchema.parse({});
    expect(defaultParsed.defaultLanguage).toBe('en');

    const bnParsed = storeGeneralSettingsSchema.parse({ defaultLanguage: 'bn' });
    expect(bnParsed.defaultLanguage).toBe('bn');

    const invalid = storeGeneralSettingsSchema.safeParse({ defaultLanguage: 'fr' });
    expect(invalid.success).toBe(false);
  });
});
