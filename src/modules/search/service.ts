import 'server-only';
import { db } from '@/lib/db';
import { format, money } from '@/lib/money';
import { toCard, type CardSource, type ProductCardData } from '@/modules/catalog/card';
import * as repo from './repository';
import type { SearchProductSuggestion, SearchResultsData, SearchSuggestionsResult } from './types';

export const POPULAR_SEARCHES = [
  'Linen Shirt',
  'Pleated Trousers',
  'Cashmere Polo',
  'Silk Overshirt',
  'Safari Jacket',
  'Fine Knitwear',
];

function toCardSource(product: repo.SearchProductRow): CardSource {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    publishedAt: product.publishedAt,
    tags: product.tags,
    category: product.category,
    variants: product.variants,
    media: product.media.map(
      (m: {
        url: string;
        alt: string | null;
        width: number | null;
        height: number | null;
        optionValueId: string | null;
        dominantColor: string | null;
        blurData: string | null;
      }) => ({
        ...m,
        alt: m.alt ?? product.title,
      }),
    ),
  };
}

export async function getLiveSearchSuggestions(query: string): Promise<SearchSuggestionsResult> {
  const clean = query.trim();
  if (clean.length < 2) {
    return {
      query: clean,
      products: [],
      categories: [],
      popular: POPULAR_SEARCHES,
    };
  }

  const now = new Date();
  const [{ items }, categories] = await Promise.all([
    repo.searchPublishedProducts(db, clean, now, { take: 5 }),
    repo.searchMatchingCategories(db, clean, 3),
  ]);

  const products: SearchProductSuggestion[] = items.map((item) => {
    const firstVariant = item.variants[0];
    const priceFormatted = firstVariant
      ? format(money(firstVariant.priceMinor, firstVariant.currency), { trimZeroFraction: true })
      : '—';
    const primaryMedia = item.media[0];

    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      categoryName: item.category?.name ?? null,
      priceFormatted,
      imageUrl: primaryMedia?.url ?? null,
      imageAlt: primaryMedia?.alt ?? item.title,
    };
  });

  return {
    query: clean,
    products,
    categories,
    popular: POPULAR_SEARCHES,
  };
}

export async function executeSearch(query: string, limit = 24): Promise<SearchResultsData> {
  const clean = query.trim();
  const now = new Date();

  if (!clean) {
    const fallbackRows = await repo.listCuratedFallbackProducts(db, now, 4);
    const suggestions = fallbackRows
      .map((row) => toCard(toCardSource(row), now))
      .filter((card): card is ProductCardData => card !== null);

    return {
      query: '',
      total: 0,
      cards: [],
      suggestions,
      popularSearches: POPULAR_SEARCHES,
    };
  }

  const { items, total } = await repo.searchPublishedProducts(db, clean, now, { take: limit });

  const cards = items
    .map((row) => toCard(toCardSource(row), now))
    .filter((card): card is ProductCardData => card !== null);

  let suggestions: ProductCardData[] = [];
  if (total === 0) {
    const fallbackRows = await repo.listCuratedFallbackProducts(db, now, 4);
    suggestions = fallbackRows
      .map((row) => toCard(toCardSource(row), now))
      .filter((card): card is ProductCardData => card !== null);
  }

  return {
    query: clean,
    total,
    cards,
    suggestions,
    popularSearches: POPULAR_SEARCHES,
  };
}
