import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 18.9 is a specification task: the acceptance criteria for the commerce abuse controls must stay
 * written into the rows that will build them, and the invariants they cite must exist. These tests
 * stop the specs from drifting or being deleted before the commerce modules are implemented.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const featureList = read('context/feature-list.md');
const skill = read('.claude/skills/auren-commerce-invariants/SKILL.md');
const architecture = read('docs/architecture/ARCHITECTURE.md');

const row = (id: string): string => {
  const line = featureList.split('\n').find((l) => l.startsWith(`| ${id} |`));
  if (!line) throw new Error(`feature row ${id} not found`);
  return line;
};

const REQUIRED: Record<string, string[]> = {
  '2.3': ['magic bytes', 'SVG', 'EXIF', 'random keys'],
  '4.1': ['.strict()', 'recomputed from database'],
  '4.6': ['INV-O8', 'INV-O11', 'idempotency key'],
  '4.8': ['OTP', 'Turnstile', 'velocity'],
  '5.2': ['OTP', 'server'],
  '5.3': ['verify-then-requery', 'INV-P5'],
  '5.5': ['step-up', 'maker-checker', 'DB CHECK'],
  '6.1': ['INV-O9', 'confirmed_by', 'confirmed_at'],
  '6.2': ['step-up', 'audit'],
  '6.13': ['INV-O9'],
  '6.14': ['re-prices'],
  '7.3': ['128 bits', 'SHA-256', 'INV-O10', 'second factor'],
  '7.9': ['step-up', 'audited'],
  '10.1': ['INV-D1', 'conditional UPDATE'],
  '10.2': ['couponApply', 'generic message'],
  '12.1': ['sanitised', 'nofollow ugc', 'reviewSubmit'],
};

describe('commerce abuse-control specs (18.9)', () => {
  it.each(Object.entries(REQUIRED))('row %s carries its security criteria', (id, needles) => {
    const text = row(id);
    const at = text.indexOf('Security (18.9');
    expect(at, `${id} needs a Security (18.9) clause`).toBeGreaterThan(-1);
    // only the security clause counts, so words elsewhere in the row cannot satisfy the check
    const clause = text.slice(at);
    for (const needle of needles) expect(clause, `${id} must mention ${needle}`).toContain(needle);
  });

  it('defines every invariant the rows and the architecture cite', () => {
    const cited = new Set(
      [...featureList.matchAll(/INV-[A-Z]\d+/g), ...architecture.matchAll(/INV-[A-Z]\d+/g)].map(
        (m) => m[0],
      ),
    );
    const defined = new Set([...skill.matchAll(/^\| (INV-[A-Z]\d+) \|/gm)].map((m) => m[1]));
    for (const id of cited) expect(defined.has(id!), `${id} is cited but not defined`).toBe(true);
  });

  it('keeps the abuse invariants that the specs rely on', () => {
    for (const id of [
      'INV-O8',
      'INV-O9',
      'INV-O10',
      'INV-O11',
      'INV-P5',
      'INV-P6',
      'INV-D1',
      'INV-A6',
      'INV-A9',
      'INV-A10',
      'INV-A11',
    ]) {
      expect(skill, id).toMatch(new RegExp(`^\\| ${id} \\|`, 'm'));
    }
  });

  it('keeps the owner decisions intact next to the new controls', () => {
    expect(skill).toMatch(/INV-O1 \|[^\n]*No auto-confirm path/);
    expect(skill).toMatch(/INV-O2 \|[^\n]*never cancels an order automatically/);
  });

  it('documents the controls in the security section of the architecture', () => {
    const start = architecture.search(/^## \d+\. Security/m);
    expect(start, 'security section heading').toBeGreaterThan(-1);
    const section = architecture.slice(start);
    for (const needle of ['INV-O8', 'INV-P5', 'INV-O9', 'Maker-checker', 'Turnstile']) {
      expect(section, needle).toContain(needle);
    }
  });
});
