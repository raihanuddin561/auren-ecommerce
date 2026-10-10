import { z } from 'zod';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .min(2, 'Slug must be at least 2 characters')
  .max(120, 'Slug must not exceed 120 characters')
  .regex(SLUG_REGEX, 'Slug must contain only lowercase letters, numbers, and single hyphens');

export const lookbookStatusSchema = z.enum(['draft', 'published', 'scheduled', 'archived']);

export const createLookbookSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(150),
  slug: slugSchema,
  season: z.string().trim().min(2, 'Season is required').max(50),
  description: z.string().trim().max(1000).optional(),
  heroImage: z.string().trim().min(1, 'Hero image URL is required'),
  heroImageAlt: z.string().trim().max(200).optional(),
  status: lookbookStatusSchema.default('draft'),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const updateLookbookSchema = z.object({
  id: z.string().uuid('Valid Lookbook ID is required'),
  title: z.string().trim().min(2).max(150).optional(),
  slug: slugSchema.optional(),
  season: z.string().trim().min(2).max(50).optional(),
  description: z.string().trim().max(1000).optional(),
  heroImage: z.string().trim().min(1).optional(),
  heroImageAlt: z.string().trim().max(200).optional(),
  status: lookbookStatusSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const createSlideSchema = z.object({
  lookbookId: z.string().uuid('Valid Lookbook ID required'),
  imageUrl: z.string().trim().min(1, 'Slide image URL required'),
  imageAlt: z.string().trim().min(2, 'Image alt text required').max(200),
  title: z.string().trim().max(150).optional(),
  caption: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const updateSlideSchema = z.object({
  id: z.string().uuid('Valid Slide ID required'),
  lookbookId: z.string().uuid('Valid Lookbook ID required'),
  imageUrl: z.string().trim().min(1).optional(),
  imageAlt: z.string().trim().min(2).max(200).optional(),
  title: z.string().trim().max(150).optional(),
  caption: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const createHotspotSchema = z.object({
  slideId: z.string().uuid('Valid Slide ID required'),
  productId: z.string().uuid('Valid Product ID required'),
  x: z.coerce.number().min(0, 'X must be at least 0%').max(100, 'X must be at most 100%'),
  y: z.coerce.number().min(0, 'Y must be at least 0%').max(100, 'Y must be at most 100%'),
  label: z.string().trim().max(120).optional(),
});

export const updateHotspotSchema = z.object({
  id: z.string().uuid('Valid Hotspot ID required'),
  slideId: z.string().uuid('Valid Slide ID required'),
  productId: z.string().uuid().optional(),
  x: z.coerce.number().min(0).max(100).optional(),
  y: z.coerce.number().min(0).max(100).optional(),
  label: z.string().trim().max(120).optional(),
});

export const lookbookFilterSchema = z.object({
  status: z.enum(['draft', 'published', 'scheduled', 'archived', 'all']).default('all'),
  search: z.string().trim().optional(),
  season: z.string().trim().optional(),
});
