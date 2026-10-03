import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { scanPath, scanText, shannonEntropy } from '../../scripts/secret-scan.mjs';

// Fake credentials are assembled at run time so this file never contains a scannable secret.
const rand = (n: number) => 'aZ3kP9xQ2mW7vB5nL8cT1yR4uE6hJ0dFgS'.repeat(3).slice(0, n);
const fakes = {
  aws: ['AK', 'IA', 'QWERTY7890ABCDEF'].join(''),
  github: ['gh', 'p_', rand(36)].join(''),
  stripe: ['sk', '_live_', rand(24)].join(''),
  google: ['AI', 'za', rand(35)].join(''),
  slack: ['xo', 'xb-', '1234567890-abcdefghij'].join(''),
  pem: ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join(''),
};

const hits = (text: string, path = 'src/x.ts') => scanText(path, text) as { rule: string }[];

describe('secret scanner', () => {
  it.each([
    ['aws-access-key', `const k = "${fakes.aws}"`],
    ['github-token', `token ${fakes.github}`],
    ['stripe-key', `STRIPE=${fakes.stripe}`],
    ['google-api-key', `key: '${fakes.google}'`],
    ['slack-token', fakes.slack],
    ['private-key', fakes.pem],
  ])('flags %s', (rule, text) => {
    expect(hits(text).map((h) => h.rule)).toContain(rule);
  });

  it('flags a connection string with a real-looking password and host', () => {
    const url = ['postgresql://', 'admin:', rand(18), '@db.prod.example-host.net:5432/auren'].join(
      '',
    );
    expect(hits(`DATABASE_URL=${url}`).map((h) => h.rule)).toContain('url-with-password');
  });

  it('flags a hardcoded high-entropy credential assignment', () => {
    expect(hits(`const apiSecret = "${rand(32)}";`).map((h) => h.rule)).toContain(
      'hardcoded-credential',
    );
  });

  it('never reports the secret value itself', () => {
    const [finding] = scanText('a.ts', `x = "${fakes.github}"`) as Record<string, unknown>[];
    expect(JSON.stringify(finding)).not.toContain(fakes.github);
  });

  it('allows documented placeholders, env references and empty values', () => {
    const safe = [
      'DATABASE_URL=postgresql://auren:auren@localhost:5432/auren',
      'BETTER_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef',
      'secret: process.env.BETTER_AUTH_SECRET_VALUE_FROM_ENV',
      'GOOGLE_CLIENT_SECRET=',
      'token: ${{ secrets.GITHUB_TOKEN_FOR_CI_RUN }}',
      'aws iam update-access-key --access-key-id AKIAIOSFODNN7EXAMPLE',
    ];
    for (const line of safe) expect(hits(line), line).toEqual([]);
  });

  it('applies the placeholder allowance to the matched value only, not the whole line', () => {
    // a documented placeholder on the line must not excuse a real-looking secret beside it
    expect(
      hits(`const note = 'see changeme'; const apiSecret = "${rand(32)}"; // your-team`).map(
        (h) => h.rule,
      ),
    ).toContain('hardcoded-credential');
    expect(
      hits(`# DATABASE_URL=postgresql://auren:auren@localhost:5432/auren ${fakes.github}`).map(
        (h) => h.rule,
      ),
    ).toContain('github-token');
    // and the placeholder itself is still fine
    expect(hits('BETTER_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef')).toEqual([]);
  });

  it('honours the inline allow marker', () => {
    expect(hits(`const apiSecret = "${rand(32)}"; // secret-scan:allow`)).toEqual([]);
  });

  it('ignores low-entropy repeated values', () => {
    expect(hits('const passwordHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa"')).toEqual([]);
  });

  it('forbids env files, keys and database dumps but allows .env.example', () => {
    for (const p of [
      '.env',
      '.env.local',
      '.env.production',
      'certs/server.pem',
      'id_rsa',
      'backup.dump',
      'credentials.json',
      '.npmrc',
    ]) {
      expect((scanPath(p) as unknown[]).length, p).toBe(1);
    }
    for (const p of ['.env.example', 'src/app/page.tsx', 'prisma/schema.prisma']) {
      expect(scanPath(p), p).toEqual([]);
    }
  });

  it('computes entropy sensibly', () => {
    expect(shannonEntropy('aaaa')).toBe(0);
    expect(shannonEntropy(rand(32))).toBeGreaterThan(3.5);
  });
});
