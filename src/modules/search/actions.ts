'use server';

import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { suggestionsInputSchema } from './schemas';
import * as service from './service';
import type { SearchSuggestionsResult } from './types';

export async function getSearchSuggestionsAction(
  input: unknown,
): Promise<ActionResult<SearchSuggestionsResult>> {
  const parsed = suggestionsInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const results = await service.getLiveSearchSuggestions(parsed.data.q);
    return ok(results);
  } catch (error) {
    return toActionError(error);
  }
}
