/**
 * Session lifetimes. Pure constants and helpers (no server-only imports) so they can be unit
 * tested and shared by the auth configuration and the staff resolver.
 */

/** Customers stay signed in for 30 days from sign-in (sessions do not slide). */
export const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Staff sessions end this long after sign-in, whatever the activity: a stolen cookie is worth at
 * most one working day. Inside the 8-12 hour range set by the security requirements.
 */
export const STAFF_SESSION_MAX_SECONDS = 10 * 60 * 60;

/** How recently a staff member must have re-entered their password or TOTP for sensitive actions. */
export const STEP_UP_WINDOW_SECONDS = 5 * 60;

/** A session is "fresh" for Better Auth's own sensitive endpoints (unlink account, delete user). */
export const FRESH_SESSION_SECONDS = 15 * 60;

/** Expiry for a new staff session: the requested expiry, but never beyond the absolute cap. */
export function staffSessionExpiresAt(now: Date, requested?: Date): Date {
  const cap = new Date(now.getTime() + STAFF_SESSION_MAX_SECONDS * 1000);
  return requested && requested.getTime() < cap.getTime() ? requested : cap;
}

/** True when a staff session has outlived the absolute cap, whatever its stored expiry says. */
export function staffSessionTooOld(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() >= STAFF_SESSION_MAX_SECONDS * 1000;
}
