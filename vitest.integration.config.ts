import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Copies only the TEST_* variables from the git-ignored .env.local (never overriding values that
// are already set). Application URLs and secrets stay untouched, so a test run can never pick up
// the development DATABASE_URL.
if (existsSync('.env.local')) {
  for (const [key, value] of Object.entries(parse(readFileSync('.env.local')))) {
    if (key.startsWith('TEST_') && process.env[key] === undefined) process.env[key] = value;
  }
}

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Integration tests run against a real PostgreSQL: a Testcontainers instance by default (needs
 * Docker), or the database in TEST_DATABASE_URL. See tests/integration/global-setup.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': r('./src'),
      'server-only': r('./tests/support/server-only-stub.ts'),
    },
  },
  test: {
    name: 'integration',
    environment: 'node',
    include: ['src/**/__tests__/**/*.int.test.ts', 'tests/integration/**/*.int.test.ts'],
    globalSetup: ['./tests/integration/global-setup.ts'],
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // One database shared by every file: run files one after another, tests inside a file in order.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
