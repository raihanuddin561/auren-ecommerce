import type { ActionResult } from '@/lib/action-result';

/** Field errors of a failed action keyed by field path ("name", "variants.2.sku", "_form"). */
export type FieldErrorMap = Record<string, string[]>;

export function fieldErrorsOf(result: ActionResult<unknown> | null): FieldErrorMap {
  return result && !result.ok ? (result.error.fieldErrors ?? {}) : {};
}

/** First message for one field, or null. */
export function firstError(errors: FieldErrorMap, key: string): string | null {
  return errors[key]?.[0] ?? null;
}

/** A calm sentence for a failed action that is not tied to one field. */
export function failureMessage(result: ActionResult<unknown>): string | null {
  if (result.ok) return null;
  return result.error.message ?? 'Something went wrong. Please try again.';
}
