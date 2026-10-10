import { z } from 'zod';

export const fitFeedbackSchema = z.enum(['runs_small', 'true_to_size', 'runs_large']);

export const submitReviewSchema = z.object({
  productId: z.string().uuid({ message: 'A valid product ID is required' }),
  rating: z.coerce
    .number()
    .int()
    .min(1, { message: 'Rating must be at least 1 star' })
    .max(5, { message: 'Rating cannot exceed 5 stars' }),
  title: z
    .string()
    .trim()
    .min(2, { message: 'Review headline must be at least 2 characters' })
    .max(120, { message: 'Review headline cannot exceed 120 characters' }),
  body: z
    .string()
    .trim()
    .min(10, { message: 'Review body must be at least 10 characters' })
    .max(3000, { message: 'Review body cannot exceed 3,000 characters' }),
  fitFeedback: fitFeedbackSchema.default('true_to_size'),
  sizePurchased: z
    .string()
    .trim()
    .max(20, { message: 'Size descriptor cannot exceed 20 characters' })
    .optional(),
  heightCm: z.coerce
    .number()
    .int()
    .min(100, { message: 'Height must be at least 100 cm' })
    .max(250, { message: 'Height must be under 250 cm' })
    .optional(),
  authorName: z
    .string()
    .trim()
    .min(2, { message: 'Author name must be at least 2 characters' })
    .max(80, { message: 'Author name cannot exceed 80 characters' }),
  authorEmail: z
    .string()
    .trim()
    .email({ message: 'Please provide a valid email address' })
    .optional()
    .or(z.literal('')),
  mediaUrls: z
    .array(z.string().url({ message: 'Media attachment must be a valid URL' }))
    .max(5, { message: 'Maximum 5 photos allowed per review' })
    .default([]),
  orderItemId: z.string().uuid().optional(),
});

export const moderateReviewSchema = z.object({
  reviewId: z.string().uuid({ message: 'A valid review ID is required' }),
  status: z.enum(['approved', 'rejected'], {
    message: 'Status must be approved or rejected',
  }),
  moderationNote: z
    .string()
    .trim()
    .max(500, { message: 'Moderation note cannot exceed 500 characters' })
    .optional(),
});

export const voteHelpfulSchema = z.object({
  reviewId: z.string().uuid({ message: 'A valid review ID is required' }),
});

export const reviewFilterSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  hasMedia: z.coerce.boolean().optional(),
  fitFeedback: fitFeedbackSchema.optional(),
  sort: z.enum(['recent', 'rating_desc', 'rating_asc', 'helpful']).default('recent'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminReviewFilterSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
  productId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
