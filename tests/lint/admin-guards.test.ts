import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  } catch {
    return [];
  }
}

const rel = (file: string) => path.relative(root, file).replaceAll('\\', '/');

describe('admin access is checked where the data is touched (INV-A1)', () => {
  const consoleFiles = walk(path.join(root, 'src/app/admin/(console)'));

  it('every admin console page and route handler calls requireStaff itself', () => {
    const entrypoints = consoleFiles.filter((f) =>
      /\/(page|route)\.tsx?$/.test(f.replaceAll('\\', '/')),
    );
    expect(entrypoints.length).toBeGreaterThan(0);
    const missing = entrypoints.filter((f) => !readFileSync(f, 'utf8').includes('requireStaff'));
    expect(missing.map(rel)).toEqual([]);
  });

  it('every admin Server Action file authenticates staff and checks a permission', () => {
    const actionFiles = walk(path.join(root, 'src/modules')).filter((f) =>
      /\/actions\.tsx?$/.test(f.replaceAll('\\', '/')),
    );
    const weak = actionFiles.filter((f) => {
      const source = readFileSync(f, 'utf8');
      const isAdmin = /requireStaff|assertPermission/.test(source) || /admin/i.test(f);
      return isAdmin && !(source.includes('requireStaff') && source.includes('assertPermission'));
    });
    expect(weak.map(rel)).toEqual([]);
  });

  it('no module action writes an order to the confirmed status outside the verification service', () => {
    // INV-O1 / ADR-015: confirmation happens only through a staff action with orders.verify.
    const offenders = walk(path.join(root, 'src'))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__'))
      .filter((f) => {
        const source = readFileSync(f, 'utf8');
        return /status:\s*['"]confirmed['"]/.test(source) && !/verif/i.test(rel(f));
      });
    expect(offenders.map(rel)).toEqual([]);
  });

  it('background jobs and cron handlers never cancel or confirm orders (INV-O1, INV-O2)', () => {
    const jobFiles = [
      ...walk(path.join(root, 'src/lib/jobs')),
      ...walk(path.join(root, 'src/modules')).filter((f) =>
        /\/jobs\.tsx?$/.test(f.replaceAll('\\', '/')),
      ),
    ];
    const offenders = jobFiles.filter((f) =>
      /cancelled|['"]confirmed['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders.map(rel)).toEqual([]);
  });
});
