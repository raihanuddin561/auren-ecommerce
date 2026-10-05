import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { env } from './env';
import { isLocalHost } from './env/production';

/** Either the root client or the client handed to an interactive transaction. */
export type Tx = PrismaClient | Prisma.TransactionClient;

function parseHost(connectionString: string): string {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return '';
  }
}

export function createDbClient(connectionString: string): PrismaClient {
  // The driver sends UTC text without an offset; a local server in another time zone would read it
  // wrongly. The migration pins the roles to UTC (ADR-027); a direct local connection also says so
  // itself. (Poolers reject unknown startup options, so only local hosts get it.)
  const host = parseHost(connectionString);
  const adapter = new PrismaPg({
    connectionString,
    max: env.DB_POOL_MAX,
    ...(host && isLocalHost(host) ? { options: '-c timezone=UTC' } : {}),
  });
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
