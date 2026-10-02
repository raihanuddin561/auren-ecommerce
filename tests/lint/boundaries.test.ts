import path from 'node:path';
import { fileURLToPath } from 'node:url';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM config module without type declarations
import { boundaryElements, boundaryPolicies } from '../../eslint.boundaries.mjs';

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

const eslint = new ESLint({
  cwd: fixtureRoot,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tseslint.parser },
      plugins: { boundaries },
      settings: {
        'boundaries/elements': boundaryElements,
        'boundaries/root-path': fixtureRoot,
        'import/resolver': { node: { extensions: ['.ts', '.tsx', '.js'] } },
      },
      rules: {
        'boundaries/dependencies': ['error', { default: 'disallow', policies: boundaryPolicies }],
      },
    },
  ],
});

/** Number of layering violations expected per fixture file (0 = allowed). */
const expected: Record<string, number> = {
  'src/modules/alpha/service.ts': 0, // own repository, internal helper, other module service, db client
  'src/modules/alpha/queries.ts': 0,
  'src/modules/alpha/actions.ts': 0,
  'src/modules/alpha/repository.ts': 0,
  'src/modules/gamma/service.ts': 1, // reaches into another module's repository
  'src/modules/delta/actions.ts': 1, // an action calling a different module's service
  'src/modules/epsilon/actions.ts': 1, // an action skipping the service layer
  'src/modules/zeta/repository.ts': 1, // a repository depending on its service
  'src/modules/theta/service.ts': 1, // another module's private internals
  'src/components/ok_actions.ts': 0,
  'src/components/bad_service.ts': 1,
  'src/components/bad_db.ts': 1,
  'src/app/ok_page.ts': 0,
  'src/app/bad_repo.ts': 1,
  'src/app/bad_db.ts': 1,
  'src/app/bad_service.ts': 1,
  'src/lib/bad_imports_service.ts': 1, // shared infrastructure must not depend on domain services
};

describe('module layering', { timeout: 60_000 }, () => {
  it.each(Object.entries(expected))('%s has %i layering violations', async (file, count) => {
    const [result] = await eslint.lintFiles([file]);
    const found = (result?.messages ?? []).filter((m) => m.ruleId === 'boundaries/dependencies');
    expect(found.map((m) => m.message)).toHaveLength(count);
  });
});
