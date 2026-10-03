import { isLocalAppUrl } from './test-bypass';
import { isLocalUrl, requiresProductionGuards } from './env/production';

/**
 * Local demo admin. `SEED_DEMO_ADMIN=1` lets `pnpm db:seed` create the seeded owner WITHOUT the
 * forced first-login password change, so a developer can try the console with a throwaway
 * password. Staff two-factor stays mandatory: the owner still enrols an authenticator.
 *
 * Same hardening style as the E2E staff bypass (lib/test-bypass.ts). Every one must hold:
 *  - SEED_DEMO_ADMIN=1, which no deployment configures;
 *  - NODE_ENV is not production;
 *  - APP_URL is set explicitly and is localhost/127.0.0.1;
 *  - DATABASE_URL (when set) points at this machine and SEED_ALLOW_REMOTE is not set;
 *  - the process is not on Vercel.
 * `parseServerEnv` refuses to boot when the flag is set anywhere else, and the production boot
 * guards reject both SEED_DEMO_ADMIN and SEED_OWNER_PASSWORD (lib/env/production.ts).
 * Pure functions, so they can be tested exhaustively and used by the seed script.
 */

type EnvSource = Record<string, string | undefined>;

const isSet = (value: string | undefined): boolean => (value?.trim() ?? '') !== '';

/** Why a requested demo admin is unsafe, or null when the configuration is acceptable. */
export function demoAdminConfigurationError(env: EnvSource): string | null {
  if (!isSet(env.SEED_DEMO_ADMIN)) return null;
  if (env.SEED_DEMO_ADMIN !== '1') return 'SEED_DEMO_ADMIN must be unset or "1"';
  if (env.VERCEL || env.VERCEL_ENV) return 'SEED_DEMO_ADMIN must never be set on Vercel';
  if (requiresProductionGuards(env)) {
    return 'SEED_DEMO_ADMIN is local-only and must not be set in production';
  }
  if (!isLocalAppUrl(env.APP_URL)) {
    return 'SEED_DEMO_ADMIN is local-only and requires APP_URL to be set to localhost';
  }
  // A weak throwaway owner must never be created on a remote database, whatever else is set.
  if (isSet(env.DATABASE_URL) && !isLocalUrl(env.DATABASE_URL!)) {
    return 'SEED_DEMO_ADMIN is local-only and requires DATABASE_URL to point at this machine';
  }
  if (env.SEED_ALLOW_REMOTE === '1') {
    return 'SEED_DEMO_ADMIN cannot be combined with SEED_ALLOW_REMOTE';
  }
  return null;
}

/** True only for a local, non-production process that explicitly asked for the demo admin. */
export function isDemoAdminAllowed(env: EnvSource = process.env): boolean {
  if (env.SEED_DEMO_ADMIN !== '1' || env.NODE_ENV === 'production') return false;
  return demoAdminConfigurationError(env) === null;
}
