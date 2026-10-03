import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import { boundaryElements, boundaryPolicies } from './eslint.boundaries.mjs';

// NOTE: 'mode: full' is deprecated in eslint-plugin-boundaries 7 but 'partialMatch: false'
// does not classify single files in 7.2, so keep 'mode' until upstream fixes it.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'src/generated/**',
    'prisma/migrations/**',
    '.claude/**',
    '.local-media/**',
    '.agents/**',
    'docs/**',
    'context/**',
    'tests/lint/fixtures/**',
  ]),
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}'],
    plugins: { boundaries },
    settings: { 'boundaries/elements': boundaryElements },
    rules: {
      'boundaries/dependencies': ['error', { default: 'disallow', policies: boundaryPolicies }],
    },
  },
  {
    // Project-wide quality rules
    files: ['**/*.{ts,tsx,mts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // INV-M1: money is never parsed as a float outside lib/money
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/money.ts', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'parseFloat', message: 'Use lib/money for amounts (INV-M1).' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Number',
          property: 'parseFloat',
          message: 'Use lib/money for amounts (INV-M1).',
        },
      ],
    },
  },
  {
    files: ['scripts/**', 'prisma/**', 'tests/**', '**/*.config.{ts,mjs}'],
    rules: { 'no-console': 'off' },
  },
]);
