import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { env } from './env';
import { isLocalHost } from './env/production';

/** Either the root client or the client handed to an interactive transaction. */
export type Tx = PrismaClient | Prisma.TransactionClient;

export function createDbClient(connectionString: string): PrismaClient {
  // The driver sends UTC text without an offset; a local server in another time zone would read it
  // wrongly. The migration pins the roles to UTC (ADR-027); a direct local connection also says so
  // itself. (Poolers reject unknown startup options, so only local hosts get it.)
  const adapter = new PrismaPg({
    connectionString,
    max: env.DB_POOL_MAX,
    ...(isLocalHost(new URL(connectionString).hostname) ? { options: '-c timezone=UTC' } : {}),
  });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

// One client per server process; reused across hot reloads in development.
const globalForDb = globalThis as unknown as { __aurenDb?: PrismaClient };

export const db: PrismaClient = globalForDb.__aurenDb ?? createDbClient(env.DATABASE_URL);

if (env.NODE_ENV !== 'production') globalForDb.__aurenDb = db;

export { Prisma };
