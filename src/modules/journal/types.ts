import type { PageStatus } from '@/generated/prisma/client';

export type ArticleStatus = PageStatus;

export interface ArticleProductSummary {
  id: string;
  title: string;
  slug: string;
  priceMinor: bigint | null;
  compareAtMinor: bigint | null;
  primaryImage: string | null;
  material: string | null;
}

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  heroImage: string;
  heroImageAlt: string | null;
  category: string;
  tags: string[];
  authorName: string;
  status: ArticleStatus;
  readTimeMinutes: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  featuredProductCount: number;
}

export interface ArticleDetailItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  heroImage: string;
  heroImageAlt: string | null;
  category: string;
  tags: string[];
  authorName: string;
  status: ArticleStatus;
  readTimeMinutes: number;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  featuredProducts: ArticleProductSummary[];
}

export interface CreateArticleInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  heroImage: string;
  heroImageAlt?: string;
  category?: string;
  tags?: string[];
  authorName?: string;
  status?: ArticleStatus;
  readTimeMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
  featuredProductIds?: string[];
}

export interface UpdateArticleInput {
  id: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  heroImage?: string;
  heroImageAlt?: string;
  category?: string;
  tags?: string[];
  authorName?: string;
  status?: ArticleStatus;
  readTimeMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
  featuredProductIds?: string[];
}

export interface ArticleFilterParams {
  status?: ArticleStatus | 'all';
  category?: string;
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface RssFeedItem {
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: Date;
  authorName: string;
  category: string;
}
