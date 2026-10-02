import 'server-only';
import { Redis } from '@upstash/redis';
import { env, services } from './env';

let client: Redis | null | undefined;

/** The Upstash Redis client, or null when Upstash is not configured (local development, tests). */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  client = services.redis
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN! })
    : null;
  return client;
}
