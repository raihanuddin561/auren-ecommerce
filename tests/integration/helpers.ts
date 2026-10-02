import { db } from '@/lib/db';

/** Tables that hold system data created by migrations; they survive a reset. */
const KEEP = new Set(['_prisma_migrations', 'role_permissions']);

/**
 * Empties every table except system data. Ledger tables refuse TRUNCATE through triggers, so the
 * reset runs with triggers disabled for this transaction only (needs the superuser the test
 * container provides).
 */
export async function resetDatabase(): Promise<void> {
  try {
    await truncateAll();
  } catch (error) {
    // A connection can be dropped after the previous test provoked a database error on purpose.
    if (!/closed the connection|Connection terminated/i.test(String(error))) throw error;
    await truncateAll();
  }
}

async function truncateAll(): Promise<void> {
  const rows = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const tables = rows.map((row) => row.tablename).filter((name) => !KEEP.has(name));
  if (tables.length === 0) return;
  const list = tables.map((name) => `"${name}"`).join(', ');
  await db.$transaction([
    db.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`),
    db.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`),
  ]);
}

export async function closeDatabase(): Promise<void> {
  await db.$disconnect();
}
