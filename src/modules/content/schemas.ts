import { z } from 'zod';

export const pageStatusEnum = z.enum(['draft', 'published', 'scheduled', 'archived']);

export const blockTypeEnum = z.enum([
  'hero_banner',
  'editorial_quote',
  'brand_perks',
  'newsletter_strip',
  'rich_text',
  'featured_collection',
  'category_grid',
  'lookbook_strip',
  'faq_accordion',
  'video_spotlight',
  'split_banner',
]);

export const heroBannerBlockSchema = z.object({
  headline: z.string().trim().min(1, 'Headline is required').max(200),
  subtitle: z.string().trim().max(400).optional(),
  ctaLabel: z.string().trim().max(80).optional(),
  ctaUrl: z.string().trim().max(300).optional(),
  secondaryCtaLabel: z.string().trim().max(80).optional(),
  secondaryCtaUrl: z.string().trim().max(300).optional(),
  mediaUrl: z.string().trim().url().optional().or(z.literal('')),
  mobileMediaUrl: z.string().trim().url().optional().or(z.literal('')),
  theme: z.enum(['ivory', 'ink']).default('ink'),
  overlayOpacity: z.number().min(0).max(100).default(30),
});

export const editorialQuoteBlockSchema = z.object({
  quote: z.string().trim().min(5, 'Quote text is required').max(600),
  author: z.string().trim().max(100).optional(),
  title: z.string().trim().max(100).optional(),
  signatureImageUrl: z.string().trim().url().optional().or(z.literal('')),
});

export const brandPerksBlockSchema = z.object({
  headline: z.string().trim().max(150).optional(),
  subtitle: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        icon: z.string().trim().min(1).default('Sparkles'),
        title: z.string().trim().min(1, 'Title required').max(100),
        description: z.string().trim().min(1, 'Description required').max(300),
      }),
    )
    .min(1, 'At least one perk is required')
    .max(6),
});

export const newsletterStripBlockSchema = z.object({
  headline: z.string().trim().min(1, 'Headline required').max(150),
  subtitle: z.string().trim().max(300).optional(),
  buttonLabel: z.string().trim().max(60).default('Request Access'),
  disclaimer: z.string().trim().max(300).optional(),
});

export const richTextBlockSchema = z.object({
  headline: z.string().trim().max(200).optional(),
  subtitle: z.string().trim().max(300).optional(),
  content: z.string().trim().min(1, 'Content is required'),
  alignment: z.enum(['left', 'center']).default('center'),
});

export const featuredCollectionBlockSchema = z.object({
  headline: z.string().trim().max(150).optional(),
  subtitle: z.string().trim().max(300).optional(),
  collectionSlug: z.string().trim().min(1, 'Collection slug is required'),
  limit: z.number().int().min(1).max(12).default(4),
  viewAllLabel: z.string().trim().max(60).default('Explore All Pieces'),
});

export const categoryGridBlockSchema = z.object({
  headline: z.string().trim().max(150).optional(),
  subtitle: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1, 'Category title required').max(100),
        href: z.string().trim().min(1, 'Link destination required').max(300),
        imageUrl: z.string().trim().url().optional().or(z.literal('')),
        subtitle: z.string().trim().max(150).optional(),
      }),
    )
    .min(1, 'At least one category required')
    .max(8),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

export const lookbookStripBlockSchema = z.object({
  headline: z.string().trim().max(150).optional(),
  subtitle: z.string().trim().max(300).optional(),
  image1Url: z.string().trim().url('Primary lookbook image URL required'),
  image2Url: z.string().trim().url('Secondary lookbook image URL required'),
  ctaLabel: z.string().trim().max(80).optional(),
  ctaUrl: z.string().trim().max(300).optional(),
});

export const faqAccordionBlockSchema = z.object({
  headline: z.string().trim().max(150).optional(),
  subtitle: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        question: z.string().trim().min(3, 'Question required').max(300),
        answer: z.string().trim().min(3, 'Answer required').max(1500),
      }),
    )
    .min(1, 'At least one FAQ item is required'),
});

export const videoSpotlightBlockSchema = z.object({
  videoUrl: z.string().trim().url('Video stream or file URL required'),
  posterUrl: z.string().trim().url().optional().or(z.literal('')),
  headline: z.string().trim().max(150).optional(),
  subtitle: z.string().trim().max(300).optional(),
  ctaLabel: z.string().trim().max(80).optional(),
  ctaUrl: z.string().trim().max(300).optional(),
});

export const splitBannerBlockSchema = z.object({
  mediaUrl: z.string().trim().url('Banner image URL required'),
  mediaPosition: z.enum(['left', 'right']).default('left'),
  eyebrow: z.string().trim().max(80).optional(),
  headline: z.string().trim().min(1, 'Headline required').max(150),
  description: z.string().trim().min(1, 'Description required').max(800),
  ctaLabel: z.string().trim().max(80).optional(),
  ctaUrl: z.string().trim().max(300).optional(),
});

export function validateBlockProps(blockType: string, rawProps: unknown) {
  switch (blockType) {
    case 'hero_banner':
      return heroBannerBlockSchema.safeParse(rawProps);
    case 'editorial_quote':
      return editorialQuoteBlockSchema.safeParse(rawProps);
    case 'brand_perks':
      return brandPerksBlockSchema.safeParse(rawProps);
    case 'newsletter_strip':
      return newsletterStripBlockSchema.safeParse(rawProps);
    case 'rich_text':
      return richTextBlockSchema.safeParse(rawProps);
    case 'featured_collection':
      return featuredCollectionBlockSchema.safeParse(rawProps);
    case 'category_grid':
      return categoryGridBlockSchema.safeParse(rawProps);
    case 'lookbook_strip':
      return lookbookStripBlockSchema.safeParse(rawProps);
    case 'faq_accordion':
      return faqAccordionBlockSchema.safeParse(rawProps);
    case 'video_spotlight':
      return videoSpotlightBlockSchema.safeParse(rawProps);
    case 'split_banner':
      return splitBannerBlockSchema.safeParse(rawProps);
    default:
      return z.record(z.string(), z.unknown()).safeParse(rawProps);
  }
}

// =============================================================================================
// Page & Section CRUD Schemas
// =============================================================================================

export const createPageSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lower-case alphanumeric with hyphens'),
  title: z.string().trim().min(2, 'Page title is required').max(150),
  description: z.string().trim().max(500).optional().nullable(),
  status: pageStatusEnum.default('draft'),
  scheduledAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val ? val : null)),
  seoTitle: z.string().trim().max(150).optional().nullable(),
  seoDescription: z.string().trim().max(300).optional().nullable(),
  ogImageUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
});

export const updatePageSchema = createPageSchema.partial().extend({
  id: z.string().uuid(),
});

export const createPageSectionSchema = z.object({
  pageId: z.string().uuid('Valid page ID required'),
  blockType: blockTypeEnum,
  name: z.string().trim().max(100).optional().nullable(),
  props: z.record(z.string(), z.unknown()).default({}),
  sortOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const updatePageSectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().max(100).optional().nullable(),
  props: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
  isVisible: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const reorderPageSectionsSchema = z.object({
  pageId: z.string().uuid(),
  sectionIds: z.array(z.string().uuid()),
});

export const pageFilterSchema = z.object({
  status: pageStatusEnum.optional(),
  search: z.string().trim().max(100).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type CreatePageSectionInput = z.infer<typeof createPageSectionSchema>;
export type UpdatePageSectionInput = z.infer<typeof updatePageSectionSchema>;
export type ReorderPageSectionsInput = z.infer<typeof reorderPageSectionsSchema>;
export type PageFilterInput = z.infer<typeof pageFilterSchema>;
