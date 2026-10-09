import { absoluteUrl } from './jsonld';

export interface FacetedRobotsAndCanonicalResult {
  canonicalUrl: string;
  robots: {
    index: boolean;
    follow: boolean;
  };
}

/**
 * Filter keys that indicate facet filtering has been applied.
 */
const FACET_KEYS = new Set([
  'color',
  'colour',
  'size',
  'fabric',
  'material',
  'inStock',
  'minPrice',
  'maxPrice',
  'priceRange',
  'filter',
  'q',
  'search',
]);

/**
 * Evaluates request search parameters against faceted navigation rules (Module 14.4).
 * Ensures search engines index only clean canonical category and collection roots,
 * and prevents indexing duplicate or thin faceted filter combinations.
 */
export function getFacetedRobotsAndCanonical(
  basePath: string,
  searchParams?: Record<string, string | string[] | undefined>,
  origin?: string,
): FacetedRobotsAndCanonicalResult {
  const canonicalUrl = absoluteUrl(basePath.split('?')[0]!, origin);

  if (!searchParams) {
    return {
      canonicalUrl,
      robots: { index: true, follow: true },
    };
  }

  const entries = Object.entries(searchParams).filter(
    ([_, val]) => val !== undefined && val !== '',
  );
  if (entries.length === 0) {
    return {
      canonicalUrl,
      robots: { index: true, follow: true },
    };
  }

  // Check if any facet filters are present
  const hasFacetFilters = entries.some(([key]) => FACET_KEYS.has(key));

  // Check pagination
  const pageParam = searchParams.page;
  const pageNum = typeof pageParam === 'string' ? parseInt(pageParam, 10) : 1;
  const hasPagination = !Number.isNaN(pageNum) && pageNum > 1;

  // Check internal search query
  const hasSearch = searchParams.q !== undefined || searchParams.search !== undefined;

  // If any facet filter, search query, or page > 1 is active, set noindex, follow
  if (hasFacetFilters || hasPagination || hasSearch) {
    return {
      canonicalUrl,
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  // Pure sort param without filters still canonicalizes to base path, but index can remain true
  return {
    canonicalUrl,
    robots: {
      index: true,
      follow: true,
    },
  };
}
