'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { Locale, TranslationDictionary } from './types';
import { DICTIONARIES, getDictionary } from './dictionary';

export const NAV_TRANSLATIONS: Record<string, string> = {
  // Top-level nav
  Shop: 'কেনাকাটা',
  New: 'নতুন',
  Collections: 'কালেকশন',
  Lookbook: 'লুকবুক',
  Journal: 'জার্নাল',
  Atelier: 'অ্যাটেলিয়ার',

  // Categories & Subcategories
  Clothing: 'পোশাক',
  Shirts: 'শার্ট',
  Trousers: 'ট্রাউজার',
  Tailoring: 'টেইলরিং',
  Knitwear: 'নিটওয়্যার',
  Polos: 'পোলো',
  Panjabi: 'পাঞ্জাবি',
  Accessories: 'এক্সেসরিজ',
  Belts: 'বেল্ট',
  Scarves: 'স্কার্ফ',
  Wallets: 'ওয়ালেট',
  Discover: 'আবিষ্কার করুন',
  'Shop all': 'সব পোশাক',
  'New arrivals': 'নতুন সংগ্রহ',
  'Winter layers': 'শীতের পোশাক',
  'The summer edit': 'সামার এডিট',
  'Tailoring for occasions': 'বিশেষ অনুষ্ঠানের টেইলরিং',
  'The edit': 'দি এডিট',
  Explore: 'ঘুরে দেখুন',
  All: 'সব',

  // Footer & Misc
  'Client care': 'গ্রাহক সেবা',
  'Track your order': 'অর্ডার ট্র্যাক করুন',
  'Shipping & delivery': 'শিপিং ও ডেলিভারি',
  'Returns & exchanges': 'রিটার্ন ও এক্সচেঞ্জ',
  'Size & fit guide': 'সাইজ ও ফিট গাইড',
  'Frequently asked questions': 'সাধারণ প্রশ্নোত্তর',
  'Contact concierge': 'কনসিয়ার্জের সাথে যোগাযোগ',
  'The House': 'আমাদের কথা',
  'About AUREN': 'অরেন সম্পর্কে',
  'The atelier & craft': 'অ্যাটেলিয়ার ও কারিগরী',
  'Natural fiber standards': 'প্রাকৃতিক তন্তুর মান',
  'Seasonal lookbooks': 'মৌসুমি লুকবুক',
  'The Journal': 'দি জার্নাল',
  'Client concierge desk': 'গ্রাহক কনসিয়ার্জ ডেস্ক',
  'Privacy policy': 'গোপনীয়তা নীতি',
  'Terms of service': 'সেবার শর্তাবলী',
  'Size guide': 'সাইজ গাইড',
  Follow: 'অনুসরণ করুন',
  'Cash on delivery': 'ক্যাশ অন ডেলিভারি',
};

export function translateLabel(label: string, locale: Locale): string {
  if (locale !== 'bn') return label;
  if (!label) return label;

  if (NAV_TRANSLATIONS[label]) {
    return NAV_TRANSLATIONS[label];
  }

  // Handle patterns like "All shirts", "All shop"
  const lower = label.toLowerCase();
  if (lower.startsWith('all ')) {
    const rest = label.slice(4).trim();
    const capitalized = rest.charAt(0).toUpperCase() + rest.slice(1);
    const translatedSub = NAV_TRANSLATIONS[capitalized] || NAV_TRANSLATIONS[rest] || rest;
    return `সব ${translatedSub}`;
  }

  return label;
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  isBn: boolean;
  t: (key: string, fallback?: string) => string;
  translateNav: (label: string) => string;
  dictionary: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LOCALE_CHANGE_EVENT = 'auren_locale_change';
const COOKIE_NAME = 'auren_locale';

let inMemoryLocale: Locale | null = null;

function getCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const val = match ? decodeURIComponent(match[1]!) : null;
  return val === 'en' || val === 'bn' ? val : null;
}

export function setCookieLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
  inMemoryLocale = locale;
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

function subscribeLocale(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
}

function getClientLocale(defaultLocale: Locale): Locale {
  if (inMemoryLocale) return inMemoryLocale;
  const fromCookie = getCookieLocale();
  if (fromCookie) {
    inMemoryLocale = fromCookie;
    return fromCookie;
  }
  return defaultLocale;
}

export function LanguageProvider({
  children,
  defaultLocale = 'en',
}: {
  children: React.ReactNode;
  defaultLocale?: Locale;
}) {
  const getSnapshot = useCallback(() => getClientLocale(defaultLocale), [defaultLocale]);
  const getServerSnapshot = useCallback(() => defaultLocale, [defaultLocale]);

  const locale = useSyncExternalStore(subscribeLocale, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setCookieLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'bn' : 'en');
  }, [locale, setLocale]);

  const dictionary = useMemo(() => getDictionary(locale), [locale]);

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const parts = path.split('.');
      let curr: unknown = dictionary;
      for (const part of parts) {
        if (curr && typeof curr === 'object' && part in curr) {
          curr = (curr as Record<string, unknown>)[part];
        } else {
          return fallback ?? path;
        }
      }
      return typeof curr === 'string' ? curr : (fallback ?? path);
    },
    [dictionary],
  );

  const translateNav = useCallback(
    (label: string): string => {
      return translateLabel(label, locale);
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      isBn: locale === 'bn',
      t,
      translateNav,
      dictionary,
    }),
    [locale, setLocale, toggleLocale, t, translateNav, dictionary],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Graceful fallback outside provider
    const fallbackDict = DICTIONARIES.en;
    return {
      locale: 'en',
      setLocale: () => {},
      toggleLocale: () => {},
      isBn: false,
      t: (key: string, fallback?: string) => fallback ?? key,
      translateNav: (label: string) => label,
      dictionary: fallbackDict,
    };
  }
  return ctx;
}

export { useTranslation as useLanguage };
