/**
 * Builders for schema.org JSON-LD. Pure and generic: pages pass plain data and get a plain object
 * back, so the shop, collection and product pages share them. Paths are site-relative; the builders
 * turn them into absolute URLs.
 */

const FALLBACK_ORIGIN = 'http://localhost:3000';

/** The site origin without a trailing slash, from NEXT_PUBLIC_APP_URL. */
export const siteOrigin = (): string =>
  (process.env.NEXT_PUBLIC_APP_URL?.trim() || FALLBACK_ORIGIN).replace(/\/+$/, '');

/** `/shop/shirts` becomes `https://auren.example/shop/shirts`; absolute URLs pass through. */
export function absoluteUrl(pathOrUrl: string, origin: string = siteOrigin()): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export type JsonLdNode = Record<string, unknown>;

export interface BreadcrumbEntry {
  name: string;
  /** Omit for the current page (schema.org then uses the page itself). */
  path?: string;
}

export function breadcrumbList(entries: readonly BreadcrumbEntry[], origin?: string): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      ...(entry.path ? { item: absoluteUrl(entry.path, origin) } : {}),
    })),
  };
}

export interface ItemListEntry {
  name: string;
  path: string;
  image?: string | null;
}

export function itemList(entries: readonly ItemListEntry[], origin?: string): JsonLdNode {
  return {
    '@type': 'ItemList',
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(entry.path, origin),
      name: entry.name,
      ...(entry.image ? { image: absoluteUrl(entry.image, origin) } : {}),
    })),
  };
}

export interface CollectionPageInput {
  name: string;
  description?: string | null;
  path: string;
  items: readonly ItemListEntry[];
  breadcrumb: readonly BreadcrumbEntry[];
}

/** One `@graph` with the page, its product list and its breadcrumb. */
export function collectionPage(input: CollectionPageInput, origin?: string): JsonLdNode {
  const url = absoluteUrl(input.path, origin);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        url,
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        mainEntity: itemList(input.items, origin),
        breadcrumb: breadcrumbList(input.breadcrumb, origin),
      },
    ],
  };
}

export interface ProductOfferInput {
  sku: string;
  /** Price in major units as a plain decimal string, for example "3290.00". Never a float. */
  price: string;
  /** The same price in minor units; used only to find the lowest and highest, never as a float. */
  priceMinor: bigint;
  currency: string;
  inStock: boolean;
}

export interface ProductJsonLdInput {
  name: string;
  description?: string | null;
  path: string;
  images: readonly string[];
  brand?: string;
  category?: string | null;
  offers: readonly ProductOfferInput[];
  breadcrumb: readonly BreadcrumbEntry[];
}

const availability = (inStock: boolean) =>
  inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

/** 7-day doorstep size exchange and returns policy across Bangladesh */
export function merchantReturnPolicyNode(): JsonLdNode {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'BD',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 7,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
    restockingFee: {
      '@type': 'MonetaryAmount',
      value: '0',
      currency: 'BDT',
    },
  };
}

/** Delivery SLA and pricing rates for Dhaka and Nationwide Bangladesh */
export function offerShippingDetailsNodes(): JsonLdNode[] {
  return [
    {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: '80.00',
        currency: 'BDT',
      },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'BD',
        addressRegion: 'Dhaka',
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 0,
          maxValue: 1,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: 1,
          maxValue: 2,
          unitCode: 'DAY',
        },
      },
    },
    {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: '150.00',
        currency: 'BDT',
      },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'BD',
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 0,
          maxValue: 1,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: 2,
          maxValue: 4,
          unitCode: 'DAY',
        },
      },
    },
  ];
}

/**
 * A Product with its Offers and the page breadcrumb in one graph. One variant gives a plain Offer;
 * several give an AggregateOffer (lowest and highest price) that lists each variant's Offer.
 */
export function productJsonLd(input: ProductJsonLdInput, origin?: string): JsonLdNode {
  const url = absoluteUrl(input.path, origin);
  const returnPolicy = merchantReturnPolicyNode();
  const shippingDetails = offerShippingDetailsNodes();

  const offers = input.offers.map((offer) => ({
    '@type': 'Offer',
    sku: offer.sku,
    url,
    price: offer.price,
    priceCurrency: offer.currency,
    availability: availability(offer.inStock),
    itemCondition: 'https://schema.org/NewCondition',
    hasMerchantReturnPolicy: returnPolicy,
    shippingDetails,
  }));
  const sorted = [...input.offers].sort((a, b) =>
    a.priceMinor < b.priceMinor ? -1 : a.priceMinor > b.priceMinor ? 1 : 0,
  );
  const currency = input.offers[0]?.currency ?? 'BDT';
  const first = offers[0];
  const offerNode =
    offers.length === 0
      ? undefined
      : offers.length === 1 && first
        ? first
        : {
            '@type': 'AggregateOffer',
            priceCurrency: currency,
            lowPrice: sorted[0]?.price,
            highPrice: sorted[sorted.length - 1]?.price,
            offerCount: offers.length,
            availability: availability(input.offers.some((offer) => offer.inStock)),
            offers,
          };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        url,
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        ...(input.images.length > 0
          ? { image: input.images.map((image) => absoluteUrl(image, origin)) }
          : {}),
        brand: { '@type': 'Brand', name: input.brand ?? 'AUREN' },
        ...(input.category ? { category: input.category } : {}),
        ...(offerNode ? { offers: offerNode } : {}),
      },
      breadcrumbList(input.breadcrumb, origin),
    ],
  };
}

/**
 * Organization structured data for brand presence, knowledge panel, and contact channels.
 */
export function organizationJsonLd(origin?: string): JsonLdNode {
  const site = origin ?? siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site}#organization`,
    name: 'AUREN',
    legalName: 'Auren Atelier Ltd.',
    url: site,
    logo: absoluteUrl('/logo.png', site),
    description:
      'Quintessential luxury menswear atelier in Dhaka. Impeccable tailoring, pure natural fibers, and quiet confidence.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'House 42, Road 11, Block D, Banani',
      addressLocality: 'Dhaka',
      postalCode: '1213',
      addressCountry: 'BD',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+8801700000000',
      contactType: 'customer service',
      areaServed: 'BD',
      availableLanguage: ['en', 'bn'],
    },
    sameAs: ['https://www.instagram.com/auren.menswear', 'https://www.facebook.com/auren.menswear'],
  };
}

/**
 * WebSite structured data with SearchAction for Sitelinks Searchbox in Google search.
 */
export function websiteJsonLd(origin?: string): JsonLdNode {
  const site = origin ?? siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site}#website`,
    url: site,
    name: 'AUREN',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@id': `${site}#organization`,
    },
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQPage structured data for rich FAQ snippet accordions in SERP.
 */
export function faqPageJsonLd(items: readonly FaqItem[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export interface ArticleInput {
  title: string;
  description: string;
  path: string;
  publishedAt: string;
  modifiedAt?: string;
  image?: string;
  author?: string;
}

/**
 * Article structured data for editorial and journal entries.
 */
export function articleJsonLd(input: ArticleInput, origin?: string): JsonLdNode {
  const url = absoluteUrl(input.path, origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: input.title,
    description: input.description,
    url,
    datePublished: input.publishedAt,
    dateModified: input.modifiedAt ?? input.publishedAt,
    author: {
      '@type': 'Person',
      name: input.author ?? 'AUREN Atelier',
    },
    publisher: {
      '@type': 'Organization',
      name: 'AUREN',
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/logo.png', origin),
      },
    },
    ...(input.image ? { image: absoluteUrl(input.image, origin) } : {}),
  };
}

const BACKSLASH = String.fromCharCode(92);
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

/** Safe to place inside a script tag: the less-than sign and the two line separators are escaped. */
export function serializeJsonLd(data: JsonLdNode): string {
  return JSON.stringify(data)
    .replace(/</g, BACKSLASH + 'u003c')
    .replace(LINE_SEPARATOR, BACKSLASH + 'u2028')
    .replace(PARAGRAPH_SEPARATOR, BACKSLASH + 'u2029');
}
