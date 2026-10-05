import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/jsonld';

/** Crawlers may read the shop; staff, account, checkout, cart, search and API paths stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/account',
        '/checkout',
        '/cart',
        '/track',
        '/wishlist',
        '/api',
        '/search',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
