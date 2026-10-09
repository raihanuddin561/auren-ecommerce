import type { Metadata } from 'next';
import { absoluteUrl } from './jsonld';

export interface PageMetadataInput {
  title?: string;
  description?: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}

const DEFAULT_DESCRIPTION =
  'AUREN — Modern, refined menswear house in Dhaka. Impeccable natural fibers, architectural drape, and quiet luxury tailoring for discerning men.';

/**
 * Strips duplicate '| AUREN' suffix if present so title templates never double up.
 */
export function sanitizeTitle(title?: string): string {
  if (!title) return 'AUREN | Quintessential Menswear Atelier';
  return title.replace(/\s*\|\s*AUREN\s*$/i, '').trim();
}

/**
 * Standard luxury metadata generator for all storefront routes.
 * Enforces canonical URL resolution, title template consistency, and Open Graph defaults.
 */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const cleanTitle = sanitizeTitle(input.title);
  const description = input.description ?? DEFAULT_DESCRIPTION;
  const canonical = absoluteUrl(input.path);
  const ogImageUrl = input.image ? absoluteUrl(input.image) : absoluteUrl('/opengraph-image');

  return {
    title: cleanTitle,
    description,
    alternates: {
      canonical,
    },
    robots: input.noIndex
      ? {
          index: false,
          follow: true,
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: canonical,
      siteName: 'AUREN',
      title: cleanTitle,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${cleanTitle} | AUREN`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: cleanTitle,
      description,
      images: [ogImageUrl],
    },
  };
}
