import { z } from 'zod';

export const analyticsRangeSchema = z.enum(['7d', '30d', '90d', '12m', 'all']).default('30d');

export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

export const analyticsFilterSchema = z.object({
  range: analyticsRangeSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AnalyticsFilterInput = z.infer<typeof analyticsFilterSchema>;
