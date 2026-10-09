import type { ProductCardData } from '@/modules/catalog/card';

export interface SearchProductSuggestion {
  id: string;
  slug: string;
  title: string;
  categoryName: string | null;
  priceFormatted: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface CategorySuggestion {
  id: string;
  name: string;
  path: string;
  slug: string;
}

export interface SearchSuggestionsResult {
  query: string;
  products: SearchProductSuggestion[];
  categories: CategorySuggestion[];
  popular: string[];
}

export interface SearchResultsData {
  query: string;
  total: number;
  cards: ProductCardData[];
  suggestions: ProductCardData[];
  popularSearches: string[];
}
