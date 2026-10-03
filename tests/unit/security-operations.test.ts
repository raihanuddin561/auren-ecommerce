import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('security operations documents (18.10)', () => {
  it('publishes the policy and the contact', () => {
    expect(read('SECURITY.md')).toMatch(/^## Reporting a vulnerability/m);
    expect(read('public/.well-known/security.txt')).toMatch(/^Contact: https:\/\//m);
  });

  it('has an incident response runbook that names containment, rotation, investigation, notification', () => {
    const text = read('docs/runbooks/incident-response.md');
    for (const heading of [/First 15 minutes/, /Rotate credentials/, /Investigate/, /Notify/]) {
      expect(text).toMatch(heading);
    }
  });

  it('has a key rotation runbook that covers every secret the application uses, and no removed provider', () => {
    const text = read('docs/runbooks/key-rotation.md');
    for (const name of [
      'BETTER_AUTH_SECRET',
      'INNGEST_SIGNING_KEY',
      'UPSTASH_REDIS_REST_TOKEN',
      'BLOB_READ_WRITE_TOKEN',
      'TURNSTILE_SECRET_KEY',
      'HEALTH_DETAIL_TOKEN',
    ]) {
      expect(text, name).toContain(name);
    }
    expect(text).not.toContain('CLOUDINARY');
  });

  it('links only to runbooks that exist', () => {
    const text = read('SECURITY.md');
    for (const [, file] of text.matchAll(/`(docs\/[\w/.-]+\.md)`/g)) {
      expect(existsSync(join(process.cwd(), file!)), file).toBe(true);
    }
  });

  it('schedules the retention job for finished outbox rows', () => {
    const jobs = read('src/lib/jobs/functions.ts');
    expect(jobs).toMatch(/id: 'event-retention'/);
    expect(jobs).toContain('purgeFinishedEvents');
    expect(jobs).toMatch(/functions = \[[^\]]*eventRetention/);
  });
});
