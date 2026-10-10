import { z } from 'zod';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const articleSlugSchema = z
  .string()
  .trim()
  .min(2, 'Slug must be at least 2 characters')
  .max(120, 'Slug must not exceed 120 characters')
  .regex(SLUG_REGEX, 'Slug must contain only lowercase letters, numbers, and single hyphens');

export const articleStatusSchema = z.enum(['draft', 'published', 'scheduled', 'archived']);

export const createArticleSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  slug: articleSlugSchema,
  excerpt: z.string().trim().min(10, 'Excerpt must be at least 10 characters').max(600),
  content: z.string().trim().min(20, 'Article body content must be at least 20 characters'),
  heroImage: z.string().trim().min(1, 'Hero image URL is required'),
  heroImageAlt: z.string().trim().max(200).optional(),
  category: z.string().trim().min(2).max(60).default('Editorial'),
  tags: z.array(z.string().trim().max(40)).default([]),
  authorName: z.string().trim().min(2).max(100).default('Auren Atelier'),
  status: articleStatusSchema.default('draft'),
  readTimeMinutes: z.coerce.number().int().min(1).max(60).default(3),
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(250).optional(),
  featuredProductIds: z.array(z.string().uuid()).default([]),
});

export const updateArticleSchema = z.object({
  id: z.string().uuid('Valid article ID is required'),
  title: z.string().trim().min(3).max(200).optional(),
  slug: articleSlugSchema.optional(),
  excerpt: z.string().trim().min(10).max(600).optional(),
  content: z.string().trim().min(20).optional(),
  heroImage: z.string().trim().min(1).optional(),
  heroImageAlt: z.string().trim().max(200).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  tags: z.array(z.string().trim().max(40)).optional(),
  authorName: z.string().trim().min(2).max(100).optional(),
  status: articleStatusSchema.optional(),
  readTimeMinutes: z.coerce.number().int().min(1).max(60).optional(),
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(250).optional(),
  featuredProductIds: z.array(z.string().uuid()).optional(),
});

export const articleFilterSchema = z.object({
  status: z.enum(['draft', 'published', 'scheduled', 'archived', 'all']).default('all'),
  category: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});
