import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --import ./scripts/stub-server-only.mjs prisma/seed.ts',
  },
  datasource: {
    // Migrations prefer the direct (non-pooled) connection when one is configured.
    url:
      process.env.DIRECT_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      // Lets `prisma generate` run in CI before any secrets exist; real commands need a real URL.
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
