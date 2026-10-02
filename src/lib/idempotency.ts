import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { Tx } from './db';
import { DomainError } from './errors';

// `work` runs inside the transaction (stock locks, order inserts); never call email/HTTP in it (INV-E1).
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 20_000 } as const;
const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Stable JSON: sorted keys, bigint written as text, so equal requests hash equally. */
function canonical(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify(`${value}n`);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** SHA-256 over the canonical form of a request, used to detect a key reused for a different request. */
export const fingerprint = (value: unknown): string =>
  createHash('sha256').update(canonical(value)).digest('hex');

export interface IdempotencyOptions {
  /** Client-supplied key, for example a UUID generated when the checkout form loads. */
  key: string;
  /** What the key protects, for example `checkout.submit`. A key cannot be reused across scopes. */
  scope: string;
  /** Who is calling (user id or guest session token). Keys are namespaced per actor so two customers can never replay each other. */
  actor: string;
  /** The request payload; a replay with a different payload is rejected. */
  request?: unknown;
  /** How long the stored response is replayable, measured by the database clock. */
  ttlSeconds?: number;
}

export interface IdempotentResult<T> {
  /** True when the stored response of an earlier identical request was returned. */
  replayed: boolean;
  value: T;
}

interface StoredKey {
  scope: string;
  request_hash: string | null;
  response: { value: unknown } | null;
}

/**
 * Runs `work` at most once per key. The key row is claimed inside the same transaction as the
 * work, so a crash rolls both back and a concurrent duplicate waits for the first to commit, then
 * receives its stored response. `work` must return JSON-safe data (use ids, not bigint or Date).
 */
export async function runIdempotent<T extends Prisma.InputJsonValue>(
  client: PrismaClient,
  options: IdempotencyOptions,
  work: (tx: Tx) => Promise<T>,
): Promise<IdempotentResult<T>> {
  const { key, scope, actor, request, ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  if (!KEY_PATTERN.test(key)) {
    throw new DomainError('VALIDATION', 'Invalid idempotency key', {
      fieldErrors: { idempotencyKey: ['Must be 8-128 characters: letters, digits, _ - : .'] },
    });
  }
  if (actor.length === 0) throw new DomainError('VALIDATION', 'An idempotency actor is required');
  const storageKey = `${actor}:${key}`;
  const requestHash = fingerprint(request ?? null);

  return client.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<Array<{ key: string }>>`
      INSERT INTO idempotency_keys (key, scope, request_hash, response, expires_at, created_at)
      VALUES (${storageKey}, ${scope}, ${requestHash}, NULL, now() + make_interval(secs => ${ttlSeconds}), now())
      ON CONFLICT (key) DO UPDATE
        SET scope = EXCLUDED.scope,
            request_hash = EXCLUDED.request_hash,
            response = NULL,
            expires_at = EXCLUDED.expires_at,
            created_at = now()
        WHERE idempotency_keys.expires_at < now()
      RETURNING key`;

    if (claimed.length === 0) {
      const [existing] = await tx.$queryRaw<StoredKey[]>`
        SELECT scope, request_hash, response FROM idempotency_keys WHERE key = ${storageKey}`;
      if (!existing || existing.scope !== scope || existing.request_hash !== requestHash) {
        throw new DomainError(
          'IDEMPOTENCY_KEY_REUSED',
          'This idempotency key was already used for a different request.',
        );
      }
      return { replayed: true, value: (existing.response?.value ?? null) as T };
    }

    const value = await work(tx);
    await tx.$executeRaw`
      UPDATE idempotency_keys SET response = ${JSON.stringify({ value })}::jsonb WHERE key = ${storageKey}`;
    return { replayed: false, value };
  }, TRANSACTION_OPTIONS);
}
