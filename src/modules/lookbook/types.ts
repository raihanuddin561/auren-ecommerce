import type { PageStatus } from '@/generated/prisma/client';

export type LookbookStatus = PageStatus;

export interface ProductSummaryForHotspot {
  id: string;
  title: string;
  slug: string;
  priceMinor: bigint | null;
  compareAtMinor: bigint | null;
  primaryImage: string | null;
  material: string | null;
}

export interface HotspotItem {
  id: string;
  slideId: string;
  productId: string;
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  label: string | null;
  product: ProductSummaryForHotspot;
}

export interface LookbookSlideItem {
  id: string;
  lookbookId: string;
  imageUrl: string;
  imageAlt: string;
  title: string | null;
  caption: string | null;
  sortOrder: number;
  hotspots: HotspotItem[];
}

export interface LookbookListItem {
  id: string;
  title: string;
  slug: string;
  season: string;
  description: string | null;
  heroImage: string;
  heroImageAlt: string | null;
  status: LookbookStatus;
  sortOrder: number;
  publishedAt: Date | null;
  slideCount: number;
  hotspotCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LookbookDetailItem {
  id: string;
  title: string;
  slug: string;
  season: string;
  description: string | null;
  heroImage: string;
  heroImageAlt: string | null;
  status: LookbookStatus;
  sortOrder: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  slides: LookbookSlideItem[];
}

export interface CreateLookbookInput {
  title: string;
  slug: string;
  season: string;
  description?: string;
  heroImage: string;
  heroImageAlt?: string;
  status?: LookbookStatus;
  sortOrder?: number;
}

export interface UpdateLookbookInput {
  id: string;
  title?: string;
  slug?: string;
  season?: string;
  description?: string;
  heroImage?: string;
  heroImageAlt?: string;
  status?: LookbookStatus;
  sortOrder?: number;
}

export interface CreateSlideInput {
  lookbookId: string;
  imageUrl: string;
  imageAlt: string;
  title?: string;
  caption?: string;
  sortOrder?: number;
}

export interface UpdateSlideInput {
  id: string;
  lookbookId: string;
  imageUrl?: string;
  imageAlt?: string;
  title?: string;
  caption?: string;
  sortOrder?: number;
}

export interface CreateHotspotInput {
  slideId: string;
  productId: string;
  x: number;
  y: number;
  label?: string;
}

export interface UpdateHotspotInput {
  id: string;
  slideId: string;
  productId?: string;
  x?: number;
  y?: number;
  label?: string;
}

export interface LookbookFilterParams {
  status?: LookbookStatus | 'all';
  search?: string;
  season?: string;
}
