export type PageStatus = 'draft' | 'published' | 'scheduled' | 'archived';

export type BlockType =
  | 'hero_banner'
  | 'editorial_quote'
  | 'brand_perks'
  | 'newsletter_strip'
  | 'rich_text'
  | 'featured_collection'
  | 'category_grid'
  | 'lookbook_strip'
  | 'faq_accordion'
  | 'video_spotlight'
  | 'split_banner';

export interface HeroBannerProps {
  headline: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  mediaUrl?: string;
  mobileMediaUrl?: string;
  theme?: 'ivory' | 'ink';
  overlayOpacity?: number;
}

export interface EditorialQuoteProps {
  quote: string;
  author?: string;
  title?: string;
  signatureImageUrl?: string;
}

export interface BrandPerkItem {
  icon: string;
  title: string;
  description: string;
}

export interface BrandPerksProps {
  headline?: string;
  subtitle?: string;
  items: BrandPerkItem[];
}

export interface NewsletterStripProps {
  headline: string;
  subtitle?: string;
  buttonLabel?: string;
  disclaimer?: string;
}

export interface RichTextProps {
  headline?: string;
  subtitle?: string;
  content: string;
  alignment?: 'left' | 'center';
}

export interface FeaturedCollectionProps {
  headline?: string;
  subtitle?: string;
  collectionSlug: string;
  limit?: number;
  viewAllLabel?: string;
}

export interface CategoryGridItem {
  title: string;
  href: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface CategoryGridProps {
  headline?: string;
  subtitle?: string;
  items: CategoryGridItem[];
  columns?: 2 | 3 | 4;
}

export interface LookbookStripProps {
  headline?: string;
  subtitle?: string;
  image1Url: string;
  image2Url: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface FaqAccordionItem {
  question: string;
  answer: string;
}

export interface FaqAccordionProps {
  headline?: string;
  subtitle?: string;
  items: FaqAccordionItem[];
}

export interface VideoSpotlightProps {
  videoUrl: string;
  posterUrl?: string;
  headline?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface SplitBannerProps {
  mediaUrl: string;
  mediaPosition?: 'left' | 'right';
  eyebrow?: string;
  headline: string;
  description: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export type SectionBlockProps =
  | HeroBannerProps
  | EditorialQuoteProps
  | BrandPerksProps
  | NewsletterStripProps
  | RichTextProps
  | FeaturedCollectionProps
  | CategoryGridProps
  | LookbookStripProps
  | FaqAccordionProps
  | VideoSpotlightProps
  | SplitBannerProps;

export interface PageSectionItem {
  id: string;
  pageId: string;
  blockType: BlockType;
  name?: string | null;
  props: Record<string, unknown>;
  sortOrder: number;
  isVisible: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageListItem {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: PageStatus;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  sectionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageDetail {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: PageStatus;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  sections: PageSectionItem[];
}

export interface PageFilterParams {
  status?: PageStatus;
  search?: string;
  cursor?: string;
  limit?: number;
}
