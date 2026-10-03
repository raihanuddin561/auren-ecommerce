import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Code only: comments are removed so a commented-out option cannot satisfy or fail a check. */
const code = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('source map handling', () => {
  it('deletes source maps after they are uploaded to Sentry', () => {
    expect(code).toMatch(/sourcemaps:\s*\{[^}]*deleteSourcemapsAfterUpload:\s*true[^}]*\}/);
  });

  it('never ships browser source maps publicly', () => {
    expect(code).not.toMatch(/productionBrowserSourceMaps/);
  });
});
