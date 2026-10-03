import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const workflows = readdirSync(path.join(root, '.github/workflows')).filter((f) =>
  f.endsWith('.yml'),
);

describe('supply chain configuration', () => {
  it('pins every GitHub Action to a full commit SHA', () => {
    const offenders: string[] = [];
    for (const file of workflows) {
      for (const line of read(`.github/workflows/${file}`).split('\n')) {
        const match = /^\s*-?\s*uses:\s*(\S+)/.exec(line);
        if (match && !/@[0-9a-f]{40}(\s|$)/.test(match[1] + ' '))
          offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never persists credentials on checkout', () => {
    for (const file of workflows) {
      const source = read(`.github/workflows/${file}`);
      const checkouts = source.split('\n').filter((l) => l.includes('actions/checkout@')).length;
      const hardened = source
        .split('\n')
        .filter((l) => l.includes('persist-credentials: false')).length;
      expect(hardened, file).toBeGreaterThanOrEqual(checkouts);
    }
  });

  it('does not run pull request code next to secrets in the preview workflow', () => {
    const source = read('.github/workflows/e2e-preview.yml');
    expect(source).not.toMatch(/ref:\s*\$\{\{\s*github\.event\.deployment\.sha/);
    expect(source).toContain('default_branch');
    expect(source).not.toContain('pull_request_target');
    for (const file of workflows) {
      expect(read(`.github/workflows/${file}`), file).not.toContain('pull_request_target');
    }
  });

  it('keeps the database image digest identical in compose, CI and the test harness', () => {
    const digest = /postgres:16-alpine@(sha256:[0-9a-f]{64})/;
    const found = [
      'docker-compose.yml',
      '.github/workflows/ci.yml',
      'tests/integration/global-setup.ts',
    ].map((file) => digest.exec(read(file))?.[1]);
    expect(found.every(Boolean)).toBe(true);
    expect(new Set(found).size).toBe(1);
    expect(read('docker-compose.yml')).toMatch(/axllent\/mailpit:v[\d.]+@sha256:[0-9a-f]{64}/);
  });

  it('sets an explicit release age, CODEOWNERS and Dependabot for actions and compose', () => {
    expect(read('pnpm-workspace.yaml')).toMatch(/^minimumReleaseAge:\s*\d+/m);
    expect(read('.github/CODEOWNERS')).toContain('/.github/');
    const dependabot = read('.github/dependabot.yml');
    for (const ecosystem of ['npm', 'github-actions', 'docker-compose']) {
      expect(dependabot).toContain(`package-ecosystem: ${ecosystem}`);
    }
  });

  it('runs CodeQL, dependency review and a blocking production audit', () => {
    expect(workflows).toEqual(
      expect.arrayContaining(['codeql.yml', 'dependency-review.yml', 'dependency-audit.yml']),
    );
    expect(read('.github/workflows/dependency-audit.yml')).toContain(
      'pnpm audit --prod --audit-level high',
    );
  });
});
