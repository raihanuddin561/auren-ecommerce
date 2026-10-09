import { z } from 'zod';

export const searchInputSchema = z
  .object({
    q: z.string().trim().max(100),
    limit: z.coerce.number().int().min(1).max(50).default(24),
  })
  .strict();

export type SearchInput = z.infer<typeof searchInputSchema>;

export const suggestionsInputSchema = z
  .object({
    q: z.string().trim().max(100),
  })
  .strict();

export type SuggestionsInput = z.infer<typeof suggestionsInputSchema>;
