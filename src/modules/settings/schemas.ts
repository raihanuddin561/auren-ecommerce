import { z } from 'zod';

/** Keys in `store_settings` that this module owns. */
export const SETTING_KEYS = {
  checkout: 'checkout.protection',
  cod: 'payments.cod',
  heroCarousel: 'storefront.hero_carousel',
} as const;

export const HERO_CAROUSEL_CACHE_TAG = 'hero-carousel';

const minorText = z.string().regex(/^\d{1,15}$/, 'Whole number of minor units');

/**
 * Checkout abuse controls (ARCHITECTURE section 6.1 and 11). Defaults are deliberately moderate:
 * a real customer rarely has more than a couple of orders waiting for a call.
 */
export const checkoutProtectionSchema = z
  .object({
    /** Ask for a code sent by SMS before an order is placed. Off until an SMS gateway is chosen. */
    otpRequired: z.boolean().default(false),
    /** Orders from one phone still waiting for staff (placed, under verification, on hold). */
    maxOpenOrdersPerPhone: z.number().int().min(1).max(20).default(3),
    maxOrdersPerPhonePerDay: z.number().int().min(1).max(50).default(5),
    /** Same delivery address, any phone. */
    maxOpenOrdersPerAddress: z.number().int().min(1).max(20).default(3),
    /** Same network address, in the last 24 hours. */
    maxOrdersPerIpPerDay: z.number().int().min(1).max(100).default(8),
    /** Units of one variant a phone may hold across orders waiting for staff (INV-O11). */
    maxUnitsPerVariantPerPhone: z.number().int().min(1).max(50).default(6),
  })
  .strict();

export type CheckoutProtection = z.infer<typeof checkoutProtectionSchema>;
export const DEFAULT_CHECKOUT_PROTECTION: CheckoutProtection = checkoutProtectionSchema.parse({});

/** Cash on delivery rule: on or off, and the largest order we will send without prepayment. */
export const codSettingsSchema = z
  .object({
    enabled: z.boolean().default(true),
    /** Minor units of the store currency, stored as text because JSON has no bigint. */
    maxOrderMinor: minorText.default('5000000'),
  })
  .strict();

export type CodSettings = z.infer<typeof codSettingsSchema>;
export const DEFAULT_COD_SETTINGS: CodSettings = codSettingsSchema.parse({});

/** What the admin form sends. Amounts are typed in taka. */
export const saveCheckoutSettingsSchema = z
  .object({
    otpRequired: z.boolean(),
    maxOpenOrdersPerPhone: z.number().int().min(1).max(20),
    maxOrdersPerPhonePerDay: z.number().int().min(1).max(50),
    maxOpenOrdersPerAddress: z.number().int().min(1).max(20),
    maxOrdersPerIpPerDay: z.number().int().min(1).max(100),
    maxUnitsPerVariantPerPhone: z.number().int().min(1).max(50),
    codEnabled: z.boolean(),
    codMaxOrder: z.string().trim().min(1).max(20),
  })
  .strict();

export type SaveCheckoutSettingsInput = z.infer<typeof saveCheckoutSettingsSchema>;

/** Hero carousel slide configuration for the storefront homepage. */
export const heroSlideSchema = z
  .object({
    id: z.string().min(1),
    eyebrow: z.string().trim().max(100).default(''),
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(500).default(''),
    primaryCtaText: z.string().trim().max(100).default(''),
    primaryCtaLink: z.string().trim().max(300).default(''),
    secondaryCtaText: z.string().trim().max(100).default(''),
    secondaryCtaLink: z.string().trim().max(300).default(''),
    imageUrl: z.string().trim().min(1, 'Image URL is required').max(1000),
    imageAlt: z.string().trim().max(200).default(''),
    overlayOpacity: z.number().int().min(0).max(90).default(25),
    textAlignment: z.enum(['left', 'center', 'right']).default('left'),
    imageFit: z.enum(['contain', 'cover']).default('cover'),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .strict();

export type HeroSlide = z.infer<typeof heroSlideSchema>;

export const heroCarouselSettingsSchema = z
  .object({
    autoplay: z.boolean().default(true),
    autoplayInterval: z.number().int().min(2000).max(20000).default(6000),
    slides: z.array(heroSlideSchema).default([]),
  })
  .strict();

export type HeroCarouselSettings = z.infer<typeof heroCarouselSettingsSchema>;

export const DEFAULT_HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: 'default-slide-1',
    eyebrow: 'NEW SEASON / 2026',
    title: 'Modern, refined menswear',
    description:
      'Elevated essentials and tailoring, crafted in breathable fabrics and made to be worn for years.',
    primaryCtaText: 'Explore the collection',
    primaryCtaLink: '/shop',
    secondaryCtaText: 'View Lookbook',
    secondaryCtaLink: '/collections',
    imageUrl: '/seed/charcoal.svg',
    imageAlt: 'Modern refined menswear tailoring',
    overlayOpacity: 25,
    textAlignment: 'left',
    imageFit: 'cover',
    active: true,
    sortOrder: 0,
  },
  {
    id: 'default-slide-2',
    eyebrow: 'THE EDIT',
    title: 'Effortless silhouettes in pure linen & silk',
    description: 'Contemporary tailoring designed for the modern tropics and discerning wardrobe.',
    primaryCtaText: 'Shop new arrivals',
    primaryCtaLink: '/shop?sort=newest',
    secondaryCtaText: 'Read the story',
    secondaryCtaLink: '/collections/winter-layers',
    imageUrl: '/seed/sand.svg',
    imageAlt: 'Sand linen shirt and tailored collection',
    overlayOpacity: 25,
    textAlignment: 'left',
    imageFit: 'cover',
    active: true,
    sortOrder: 1,
  },
  {
    id: 'default-slide-3',
    eyebrow: 'TIMELESS ARCHIVE',
    title: 'Architectural cuts, enduring comfort',
    description:
      'Precision-tailored shirts and formal wear constructed with heritage sartorial standards.',
    primaryCtaText: 'Discover tailoring',
    primaryCtaLink: '/shop/tailoring',
    secondaryCtaText: '',
    secondaryCtaLink: '',
    imageUrl: '/seed/charcoal.svg',
    imageAlt: 'Auren bespoke menswear',
    overlayOpacity: 25,
    textAlignment: 'left',
    imageFit: 'cover',
    active: true,
    sortOrder: 2,
  },
];

export const DEFAULT_HERO_CAROUSEL_SETTINGS: HeroCarouselSettings = {
  autoplay: true,
  autoplayInterval: 6000,
  slides: [...DEFAULT_HERO_SLIDES],
};

export const saveHeroCarouselSettingsSchema = heroCarouselSettingsSchema;
export type SaveHeroCarouselSettingsInput = z.infer<typeof saveHeroCarouselSettingsSchema>;
