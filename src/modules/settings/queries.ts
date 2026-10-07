import { cacheLife, cacheTag } from 'next/cache';
import { toDecimalString, money } from '@/lib/money';
import { HERO_CAROUSEL_CACHE_TAG, type HeroCarouselSettings } from './schemas';
import { getCheckoutProtection, getCodSettings, getHeroCarouselSettings } from './service';
import type { CheckoutSettingsView } from './types';

/** Cash on delivery and checkout protection as the settings form shows them. */
export async function getCheckoutSettingsForAdmin(): Promise<CheckoutSettingsView> {
  const [protection, cod] = await Promise.all([getCheckoutProtection(), getCodSettings()]);
  return {
    ...protection,
    codEnabled: cod.enabled,
    codMaxOrder: toDecimalString(money(BigInt(cod.maxOrderMinor), 'BDT')),
  };
}

/**
 * Returns active slides for the storefront home page hero carousel. Cached and tagged.
 */
export async function getHeroCarouselForStorefront(): Promise<HeroCarouselSettings> {
  'use cache';
  cacheLife('hours');
  cacheTag(HERO_CAROUSEL_CACHE_TAG);
  const settings = await getHeroCarouselSettings();
  const activeSlides = settings.slides.filter((slide) => slide.active);
  return {
    ...settings,
    slides: activeSlides.length > 0 ? activeSlides : settings.slides,
  };
}

/** Returns the hero carousel settings for admin management (includes inactive slides). */
export async function getHeroCarouselForAdmin(): Promise<HeroCarouselSettings> {
  return getHeroCarouselSettings();
}
