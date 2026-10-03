import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import type { z } from 'zod';
import { isDomainError, type DomainErrorCode, type FieldErrors } from './errors';
import { MoneyError } from './money';
import { logger } from './logger';

export interface ActionError {
  code: DomainErrorCode;
  message?: string;
  fieldErrors?: FieldErrors;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (
  code: DomainErrorCode,
  message?: string,
  fieldErrors?: FieldErrors,
): ActionResult<never> => ({
  ok: false,
  error: { code, ...(message ? { message } : {}), ...(fieldErrors ? { fieldErrors } : {}) },
});

/** Turns a failed Zod parse into the standard validation result. */
export function validationError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail('VALIDATION', 'Please check the highlighted fields.', fieldErrors);
}

const PUBLIC_MESSAGES: Partial<Record<DomainErrorCode, string>> = {
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'We could not find that.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  STEP_UP_REQUIRED: 'Please confirm your password or authentication code to continue.',
  INTERNAL: 'Something went wrong on our side. Please try again.',
};

interface PrismaRequestError {
  name: string;
  code: string;
  meta?: { target?: unknown };
}

const isPrismaRequestError = (error: unknown): error is PrismaRequestError =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'PrismaClientKnownRequestError' &&
  typeof (error as { code?: unknown }).code === 'string';

/** Which form field a violated unique constraint belongs to, from its name or column list. */
function uniqueField(target: unknown): string | null {
  const text = (Array.isArray(target) ? target.join(',') : String(target ?? '')).toLowerCase();
  if (text.includes('sku')) return 'sku';
  if (text.includes('slug') || text.includes('path')) return 'slug';
  if (text.includes('email')) return 'email';
  return null;
}

/**
 * Converts anything thrown inside an action into an ActionResult.
 * Next.js control-flow errors (redirect, notFound) are re-thrown untouched.
 */
export function toActionError(error: unknown): ActionResult<never> {
  unstable_rethrow(error);
  if (isDomainError(error)) {
    const message = error.message === error.code ? PUBLIC_MESSAGES[error.code] : error.message;
    return fail(error.code, message, error.fieldErrors);
  }
  if (error instanceof MoneyError) return fail('VALIDATION', error.message);
  // Two people saved the same slug or SKU at once: the unique index decided. Say so plainly.
  if (isPrismaRequestError(error) && error.code === 'P2002') {
    const field = uniqueField(error.meta?.target);
    const message = 'That value is already in use. Choose another and try again.';
    return fail('CONFLICT', message, field ? { [field]: [message] } : undefined);
  }
  if (isPrismaRequestError(error) && error.code === 'P2003') {
    return fail('CONFLICT', 'Something still depends on this, so it cannot be changed that way.');
  }
  logger.error({ err: error }, 'unhandled error in action');
  return fail('INTERNAL', PUBLIC_MESSAGES.INTERNAL);
}
