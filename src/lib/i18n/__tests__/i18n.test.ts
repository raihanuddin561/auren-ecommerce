import { describe, expect, it } from 'vitest';
import { DICTIONARIES, getDictionary } from '../dictionary';
import { translateLabel, NAV_TRANSLATIONS } from '../context';
import {
  toBengaliDigits,
  translateCategory,
  translateColor,
  translateSize,
  translateBadge,
  translateOrderStatus,
  translateProductTitle,
  translateCatalogPhrase,
} from '../catalog-translator';
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

describe('Hybrid Catalog Translator', () => {
  it('converts Western numbers to Bengali digits accurately', () => {
    expect(toBengaliDigits(0)).toBe('০');
    expect(toBengaliDigits(123456789)).toBe('১২৩৪৫৬৭৮৯');
    expect(toBengaliDigits('৳ 2,490')).toBe('৳ ২,৪৯০');
  });

  it('translates catalog categories, colors, sizes, and badges', () => {
    expect(translateCategory('Shirts', 'en')).toBe('Shirts');
    expect(translateCategory('Shirts', 'bn')).toBe('শার্ট');
    expect(translateCategory('Tailoring', 'bn')).toBe('টেইলরিং');
    expect(translateCategory('Accessories', 'bn')).toBe('এক্সেসরিজ');

    expect(translateColor('Navy', 'en')).toBe('Navy');
    expect(translateColor('Navy', 'bn')).toBe('নেভি ব্লু');
    expect(translateColor('Ivory', 'bn')).toBe('আইভরি');
    expect(translateColor('Charcoal', 'bn')).toBe('চারকোল');

    expect(translateSize('Medium', 'en')).toBe('Medium');
    expect(translateSize('Medium', 'bn')).toBe('মাঝারি (M)');
    expect(translateSize('Small', 'bn')).toBe('ছোট (S)');

    expect(translateBadge('Best Seller', 'en')).toBe('Best Seller');
    expect(translateBadge('Best Seller', 'bn')).toBe('সেরা বিক্রিত');
    expect(translateBadge('Limited Edition', 'bn')).toBe('সীমিত সংস্করণ');

    expect(translateOrderStatus('processing', 'en')).toBe('processing');
    expect(translateOrderStatus('processing', 'bn')).toBe('প্রস্তুত হচ্ছে');
    expect(translateOrderStatus('delivered', 'bn')).toBe('ডেলিভারি সম্পন্ন');
  });

  it('prioritizes explicit DB Bangla overrides over automatic glossary', () => {
    // Without DB override -> uses automatic catalog translator
    expect(translateProductTitle('Egyptian Cotton Shirt', 'en')).toBe('Egyptian Cotton Shirt');
    expect(translateProductTitle('Egyptian Cotton Shirt', 'bn')).toBe('মিশরীয় কটন শার্ট');

    // With explicit DB override -> uses explicit translation directly
    expect(
      translateProductTitle(
        'Egyptian Cotton Shirt',
        'bn',
        'রয়েল মিশরীয় তুলা শার্ট (এক্সক্লুসিভ)',
      ),
    ).toBe('রয়েল মিশরীয় তুলা শার্ট (এক্সক্লুসিভ)');

    // In English mode, explicit DB Bangla override is ignored to preserve English catalog
    expect(
      translateProductTitle(
        'Egyptian Cotton Shirt',
        'en',
        'রয়েল মিশরীয় তুলা শার্ট (এক্সক্লুসিভ)',
      ),
    ).toBe('Egyptian Cotton Shirt');
  });

  it('handles compound product phrases naturally', () => {
    expect(translateCatalogPhrase('Irish Linen Trouser')).toBe('আইরিশ লিনেন ট্রাউজার');
    expect(translateCatalogPhrase('Merino Wool Blazer')).toBe('মেরিনো উল ব্লেজার');
  });
});
