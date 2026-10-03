import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const appDir = path.join(root, 'src/app');

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

const slashes = (value: string) => value.split(path.sep).join('/');
const rel = (file: string) => slashes(path.relative(root, file));

/** URL path of a file under src/app: route groups removed. */
const urlPath = (file: string) =>
  '/' +
  path
    .relative(appDir, path.dirname(file))
    .split(path.sep)
    .filter((part) => part && !/^\(.*\)$/.test(part))
    .join('/');

const inSection = (url: string, prefixes: string[]) =>
  prefixes.some((p) => url === p || url.startsWith(`${p}/`));

/**
 * ADR-022: pages under /admin, /checkout and /account are rendered per request so the proxy's
 * nonce reaches their scripts. A section's root layout must wait for the request (connection())
 * and allow the blocking route (instant = false); nothing in a section may be prerendered or
 * cached; every script tag there must carry the nonce.
 */
describe('nonce sections are rendered per request', () => {
  const sections = ['/admin', '/checkout', '/account'];
  const files = walk(appDir).filter((f) => /\.(tsx|ts)$/.test(f));
  const sectionFiles = files.filter((f) => inSection(urlPath(f), sections));

  it('every section that has pages has a root layout that awaits connection() and sets instant = false', () => {
    for (const section of sections) {
      const pages = sectionFiles.filter(
        (f) => /\/page\.tsx$/.test(slashes(f)) && inSection(urlPath(f), [section]),
      );
      if (pages.length === 0) continue; // section not built yet
      const rootLayout = files.find(
        (f) =>
          /\/layout\.tsx$/.test(slashes(f)) &&
          urlPath(f) === section &&
          // the section's own folder, not a route group inside it
          path.basename(path.dirname(f)) === section.slice(1),
      );
      expect(
        rootLayout,
        `${section} needs a root layout that opts into dynamic rendering`,
      ).toBeTruthy();
      const source = readFileSync(rootLayout!, 'utf8');
      expect(source, rel(rootLayout!)).toContain('await connection()');
      expect(source, rel(rootLayout!)).toMatch(/export const instant = false/);
    }
  });

  it('nothing inside a section is prerendered or cached', () => {
    const offenders = sectionFiles.filter((f) => {
      const source = readFileSync(f, 'utf8');
      return /['"]use cache['"]|generateStaticParams|export const revalidate|dynamic\s*=\s*['"]force-static['"]/.test(
        source,
      );
    });
    expect(offenders.map(rel)).toEqual([]);
  });

  it('every script emitted inside a section carries the nonce', () => {
    const offenders: string[] = [];
    for (const file of sectionFiles) {
      const source = readFileSync(file, 'utf8');
      for (const tag of source.match(/<script\b[^>]*>/g) ?? []) {
        if (!tag.includes('nonce=')) offenders.push(`${rel(file)}: ${tag}`);
      }
      // next/script is nonce-aware only when given one
      for (const tag of source.match(/<Script\b[^>]*>/g) ?? []) {
        if (!tag.includes('nonce=')) offenders.push(`${rel(file)}: ${tag}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
