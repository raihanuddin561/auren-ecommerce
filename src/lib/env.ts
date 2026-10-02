import 'server-only';
import { describeServices, parseServerEnv, type ServerEnv } from './env/schema';

/**
 * Validated server environment. Importing this module fails fast with a readable list of problems.
 * Set SKIP_ENV_VALIDATION=1 only for tooling that never touches the app (for example `prisma generate` in CI).
 */
export const env: ServerEnv =
  process.env.SKIP_ENV_VALIDATION === '1'
    ? (process.env as unknown as ServerEnv)
    : parseServerEnv(process.env);

export const services = describeServices(env);

export const isProduction = env.NODE_ENV === 'production';
