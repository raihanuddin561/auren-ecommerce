import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { env } from './env';

/** Either the root client or the client handed to an interactive transaction. */
export type Tx = PrismaClient | Prisma.TransactionClient;

export function createDbClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString, max: env.DB_POOL_MAX });
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
