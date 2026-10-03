import 'server-only';
import { describeServices, parseServerEnv, skipsEnvValidation, type ServerEnv } from './env/schema';

/**
 * Validated server environment. Importing this module fails fast with a readable list of problems.
 * SKIP_ENV_VALIDATION=1 is honoured for tooling and `next build` only; a production server ignores it.
 */
export const env: ServerEnv = skipsEnvValidation(process.env)
  ? (process.env as unknown as ServerEnv)
  : parseServerEnv(process.env);

export const services = describeServices(env);

export const isProduction = env.NODE_ENV === 'production';
