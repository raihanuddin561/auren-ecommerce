import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/jsonld';
import { listSitemapEntries } from '@/modules/catalog/queries';

/** Static addresses that exist today. Pages that need an account or a session are never listed. */
const STATIC_PATHS = ['/', '/shop'];

/**
 * Every live product, collection and category, with product pictures (ARCHITECTURE section 9).
 * Cached under the `sitemap` tag, which every publish invalidates, and revalidated hourly.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await listSitemapEntries();
  return [
    ...STATIC_PATHS.map((path) => ({ url: absoluteUrl(path), changeFrequency: 'daily' as const })),
    ...entries.map((entry) => ({
      url: absoluteUrl(entry.path),
      lastModified: entry.lastModified,
      ...(entry.images.length > 0
        ? { images: entry.images.map((image) => absoluteUrl(image)) }
        : {}),
    })),
  ];
}
