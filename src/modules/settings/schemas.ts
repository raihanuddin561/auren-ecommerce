import { z } from 'zod';

/** Keys in `store_settings` that this module owns. */
export const SETTING_KEYS = {
  general: 'store.general',
  checkout: 'checkout.protection',
  cod: 'payments.cod',
  heroCarousel: 'storefront.hero_carousel',
  navigation: 'storefront.navigation',
  verification: 'orders.verification',
  returns: 'orders.returns',
} as const;

export const HERO_CAROUSEL_CACHE_TAG = 'hero-carousel';
export const NAVIGATION_CACHE_TAG = 'storefront-navigation';

export const storeGeneralSettingsSchema = z
  .object({
    storeName: z.string().trim().min(1, 'Store name is required').max(100).default('AUREN'),
    tagline: z.string().trim().max(200).default('Modern, Refined Menswear'),
    supportEmail: z.string().trim().email('Invalid email address').default('concierge@auren.com'),
    supportPhone: z
      .string()
      .trim()
      .min(1, 'Support phone is required')
      .max(30)
      .default('+880 1700-000000'),
    whatsappNumber: z.string().trim().max(30).default('+880 1700-000000'),
    address: z
      .string()
      .trim()
      .max(300)
      .default('House 12, Road 11, Banani, Dhaka 1213, Bangladesh'),
    binNumber: z.string().trim().max(50).default('001234567-0101'),
    vatPercentage: z.number().min(0).max(100).default(5),
    pricesIncludeVat: z.boolean().default(true),
    currency: z.literal('BDT').default('BDT'),
    timezone: z.literal('Asia/Dhaka').default('Asia/Dhaka'),
    socialInstagram: z.string().trim().max(200).default('https://instagram.com/auren.menswear'),
    socialFacebook: z.string().trim().max(200).default('https://facebook.com/auren.menswear'),
    socialYoutube: z.string().trim().max(200).default(''),
  })
  .strict();

export type StoreGeneralSettings = z.infer<typeof storeGeneralSettingsSchema>;
export const DEFAULT_STORE_GENERAL_SETTINGS: StoreGeneralSettings =
  storeGeneralSettingsSchema.parse({});

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

/**
 * Staff verification: working hours, target time and the attempt threshold (OD-11), the claim lock,
 * and whether staff may confirm their own manual orders (ARCHITECTURE section 6.1). Nothing here can
 * switch on automatic confirmation or cancellation: those paths do not exist.
 */
export const verificationSettingsSchema = z
  .object({
    /** Target time from placed to verified, in working minutes. */
    slaMinutes: z.number().int().min(15).max(1440).default(120),
    /** First working hour (0 to 23) and the hour the day ends (1 to 24), shop time. */
    workStartHour: z.number().int().min(0).max(23).default(10),
    workEndHour: z.number().int().min(1).max(24).default(21),
    /** Failed contact attempts after which the order is flagged for a manager. */
    attemptThreshold: z.number().int().min(1).max(10).default(3),
    /** How long a claim keeps an order for one staff member. */
    claimMinutes: z.number().int().min(5).max(120).default(15),
    /** Whether the creator of a manual order may confirm it themselves. */
    manualOrdersSelfVerify: z.boolean().default(false),
  })
  .strict()
  .refine((value) => value.workEndHour > value.workStartHour, {
    message: 'The working day must end after it starts.',
    path: ['workEndHour'],
  });

export type VerificationSettings = z.infer<typeof verificationSettingsSchema>;
export const DEFAULT_VERIFICATION_SETTINGS: VerificationSettings = verificationSettingsSchema.parse(
  {},
);

/** The return window: how many days after delivery a customer can ask to return. */
export const returnSettingsSchema = z
  .object({ windowDays: z.number().int().min(1).max(90).default(7) })
  .strict();
export type ReturnSettings = z.infer<typeof returnSettingsSchema>;
export const DEFAULT_RETURN_SETTINGS: ReturnSettings = returnSettingsSchema.parse({});

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

/** What the order rules form sends: verification rules and the return window, saved together. */
export const saveOrderRulesSchema = z
  .object({
    slaMinutes: z.number().int().min(15).max(1440),
    workStartHour: z.number().int().min(0).max(23),
    workEndHour: z.number().int().min(1).max(24),
    attemptThreshold: z.number().int().min(1).max(10),
    claimMinutes: z.number().int().min(5).max(120),
    manualOrdersSelfVerify: z.boolean(),
    returnWindowDays: z.number().int().min(1).max(90),
  })
  .strict()
  .refine((value) => value.workEndHour > value.workStartHour, {
    message: 'The working day must end after it starts.',
    path: ['workEndHour'],
  });
export type SaveOrderRulesInput = z.infer<typeof saveOrderRulesSchema>;

// ---------------------------------------------------------------------------------------------
// Navigation & Mega Menu Settings
// ---------------------------------------------------------------------------------------------

export const navLinkSchema = z
  .object({
    label: z.string().trim().min(1, 'Label is required').max(60),
    href: z.string().trim().min(1, 'Link URL is required').max(300),
  })
  .strict();

export const megaMenuTileSchema = z
  .object({
    eyebrow: z.string().trim().max(60).default(''),
    title: z.string().trim().max(100).default(''),
    href: z.string().trim().max(300).default(''),
    image: z.string().trim().max(500).default(''),
    imageAlt: z.string().trim().max(120).default(''),
  })
  .strict();

export const navColumnSchema = z
  .object({
    heading: z.string().trim().min(1, 'Column heading is required').max(60),
    links: z.array(navLinkSchema).default([]),
  })
  .strict();

export const navItemSchema = z
  .object({
    label: z.string().trim().min(1, 'Menu label is required').max(60),
    href: z.string().trim().min(1, 'Menu link URL is required').max(300),
    columns: z.array(navColumnSchema).optional(),
    tile: megaMenuTileSchema.optional(),
  })
  .strict();

export const navigationSettingsSchema = z
  .object({
    items: z.array(navItemSchema).min(1, 'At least one menu item is required').max(20),
  })
  .strict();

export type NavigationSettings = z.infer<typeof navigationSettingsSchema>;
export type NavItemInput = z.infer<typeof navItemSchema>;
export type NavColumnInput = z.infer<typeof navColumnSchema>;
export type NavLinkInput = z.infer<typeof navLinkSchema>;
export type MegaMenuTileInput = z.infer<typeof megaMenuTileSchema>;

export const DEFAULT_NAVIGATION_SETTINGS: NavigationSettings = {
  items: [
    {
      label: 'Shop',
      href: '/shop',
      columns: [
        {
          heading: 'Clothing',
          links: [
            { label: 'Shirts', href: '/shop/shirts' },
            { label: 'Trousers', href: '/shop/trousers' },
            { label: 'Tailoring', href: '/shop/tailoring' },
            { label: 'Knitwear', href: '/shop/knitwear' },
            { label: 'Polos', href: '/shop/polos' },
          ],
        },
        {
          heading: 'Accessories',
          links: [
            { label: 'Belts', href: '/shop/accessories' },
            { label: 'Scarves', href: '/shop/accessories' },
            { label: 'Wallets', href: '/shop/accessories' },
          ],
        },
        {
          heading: 'Discover',
          links: [
            { label: 'Shop all', href: '/shop' },
            { label: 'New arrivals', href: '/shop?sort=newest' },
          ],
        },
      ],
      tile: {
        eyebrow: 'The edit',
        title: 'Winter layers',
        href: '/collections/winter-layers',
        image: '/seed/sand.svg',
        imageAlt: 'Sand coloured shirt',
      },
    },
    { label: 'New', href: '/shop?sort=newest' },
    {
      label: 'Collections',
      href: '/collections',
      columns: [
        {
          heading: 'Collections',
          links: [
            { label: 'Winter layers', href: '/collections/winter-layers' },
            { label: 'The summer edit', href: '/collections/the-summer-edit' },
            { label: 'Tailoring for occasions', href: '/collections/tailoring-for-occasions' },
          ],
        },
      ],
      tile: {
        eyebrow: 'Lookbook',
        title: 'Tailoring for occasions',
        href: '/collections/tailoring-for-occasions',
        image: '/seed/charcoal.svg',
        imageAlt: 'Charcoal tailoring',
      },
    },
    { label: 'Lookbook', href: '/lookbook' },
    { label: 'Journal', href: '/journal' },
  ],
};
