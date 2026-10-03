export type DomainErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'OUT_OF_STOCK'
  | 'INVALID_TRANSITION'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'TWO_FACTOR_REQUIRED'
  | 'STEP_UP_REQUIRED'
  | 'APPROVAL_REQUIRED'
  | 'INTERNAL';

export type FieldErrors = Record<string, string[]>;

/**
 * A failure the caller can act on. Services throw these; Server Actions translate them into
 * `ActionResult` values with `toActionError`. Anything that is not a DomainError is a bug.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message?: string,
    public readonly details: { fieldErrors?: FieldErrors; cause?: unknown } = {},
  ) {
    super(message ?? code, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = 'DomainError';
  }

  get fieldErrors(): FieldErrors | undefined {
    return this.details.fieldErrors;
  }
}

export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError;
