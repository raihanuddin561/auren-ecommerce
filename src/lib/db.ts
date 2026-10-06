import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { env } from './env';
import { isLocalHost } from './env/production';

import { Pool, type PoolConfig } from 'pg';

/** Either the root client or the client handed to an interactive transaction. */
export type Tx = PrismaClient | Prisma.TransactionClient;

function normalizeConnectionString(connectionString: string): {
  normalizedUrl: string;
  isLocal: boolean;
} {
  try {
    const u = new URL(connectionString);
    const host = u.hostname.toLowerCase();
    const isLocal = isLocalHost(host);
    if (!isLocal) {
      // Supabase transaction poolers & remote hosted Postgres often use self-signed / intermediate cert chains.
      // uselibpqcompat=true tells pg-connection-string to follow libpq semantics (encryption without failing on intermediate certs).
      if (!u.searchParams.has('uselibpqcompat')) {
        u.searchParams.set('uselibpqcompat', 'true');
      }
    }
    return { normalizedUrl: u.toString(), isLocal };
  } catch {
    return { normalizedUrl: connectionString, isLocal: false };
  }
}

export function createDbClient(connectionString: string): PrismaClient {
  // The driver sends UTC text without an offset; a local server in another time zone would read it
  // wrongly. The migration pins the roles to UTC (ADR-027); a direct local connection also says so
  // itself. (Poolers reject unknown startup options, so only local hosts get it.)
  const { normalizedUrl, isLocal } = normalizeConnectionString(connectionString);
  const poolConfig: PoolConfig = {
    connectionString: normalizedUrl,
    max: env.DB_POOL_MAX,
    ...(isLocal ? { options: '-c timezone=UTC' } : { ssl: { rejectUnauthorized: false } }),
  };
  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// One client per server process; reused across hot reloads in development.
const globalForDb = globalThis as unknown as { __aurenDb?: PrismaClient };

const connectionUrl =
  env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://localhost:5432/auren';

export const db: PrismaClient = globalForDb.__aurenDb ?? createDbClient(connectionUrl);

if (env.NODE_ENV !== 'production') globalForDb.__aurenDb = db;

export { Prisma };
