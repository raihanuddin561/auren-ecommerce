import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const full = { statements: 100, branches: 100, functions: 100, lines: 100 };

export default defineConfig({
  resolve: {
    alias: {
      '@': r('./src'),
      'server-only': r('./tests/support/server-only-stub.ts'),
    },
  },
  test: {
    name: 'unit',
    environment: 'node',
    setupFiles: ['./tests/support/setup-env.ts'],
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'tests/lint/**/*.test.ts',
      'tests/unit/**/*.test.ts',
    ],
    exclude: ['**/*.int.test.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/money.ts'],
      thresholds: { 'src/lib/money.ts': full },
    },
  },
});
