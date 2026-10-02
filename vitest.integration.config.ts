import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

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
