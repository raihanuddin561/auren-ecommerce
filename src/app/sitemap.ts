import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/jsonld';
import { listSitemapEntries } from '@/modules/catalog/queries';

interface StaticRouteConfig {
  path: string;
  priority: number;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

/** Static editorial and policy addresses that exist in the storefront. */
const STATIC_ROUTES: readonly StaticRouteConfig[] = [
  { path: '/', priority: 1.0, changeFrequency: 'daily' },
  { path: '/shop', priority: 0.9, changeFrequency: 'daily' },
  { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/shipping', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/returns', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/size-guide', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
];

/**
 * Complete sitemap index for search engines (Module 14.3).
 * Lists every static landing page, live category, collection, and product with high-res photography.
 * Cached under the `sitemap` tag and revalidated hourly.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let entries: Awaited<ReturnType<typeof listSitemapEntries>> = [];
  try {
    entries = await listSitemapEntries();
  } catch {
    entries = [];
  }

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const dynamicEntries: MetadataRoute.Sitemap = entries.map((entry) => {
    const isProduct = entry.path.startsWith('/products/');
    return {
      url: absoluteUrl(entry.path),
      lastModified: entry.lastModified,
      changeFrequency: isProduct ? ('daily' as const) : ('weekly' as const),
      priority: isProduct ? 0.9 : 0.8,
      ...(entry.images.length > 0
        ? { images: entry.images.map((image) => absoluteUrl(image)) }
        : {}),
    };
  });

  return [...staticEntries, ...dynamicEntries];
}
