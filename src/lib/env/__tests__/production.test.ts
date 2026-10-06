import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseServerEnv, skipsEnvValidation } from '../schema';
import { entropyBitsPerChar, weakSecretReason } from '../production';

// A random-looking value that is not a placeholder (generated once for these tests only).
const STRONG_SECRET = 'q7Zk2vN9xRw4TbYh8LmC3sPd6JfGa1UeVn5oXiK0yHc=';

const production = {
  NODE_ENV: 'production',
  APP_URL: 'https://auren.example.com',
  NEXT_PUBLIC_APP_URL: 'https://auren.example.com',
  DATABASE_URL:
    'postgresql://auren_app.proj:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require',
  DIRECT_URL: 'postgresql://auren_migrator:pw@db.proj.supabase.co:5432/postgres?sslmode=require',
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test_token',
  BETTER_AUTH_SECRET: STRONG_SECRET,
  UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'upstash-token-value',
  INNGEST_SIGNING_KEY: 'signkey-prod-abc',
  INNGEST_EVENT_KEY: 'event-key-abc',
  RESEND_API_KEY: 're_example',
  EMAIL_FROM: 'AUREN <orders@auren.example.com>',
  TRUSTED_PROXY: 'hops:1',
};

const without = (key: keyof typeof production) => {
  const copy: Record<string, string | undefined> = { ...production };
  delete copy[key];
  return copy;
};

const issuesOf = (source: Record<string, string | undefined>): string => {
  try {
    parseServerEnv(source);
    return '';
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return (error as EnvValidationError).issues.join('\n');
  }
};

describe('production boot guards', () => {
  it('accepts a complete production configuration', () => {
    expect(issuesOf(production)).toBe('');
  });

  it('refuses a missing APP_URL instead of falling back to localhost', () => {
    expect(issuesOf(without('APP_URL'))).toMatch(/APP_URL: is required/);
  });

  it('refuses a public URL that differs from APP_URL', () => {
    expect(issuesOf({ ...production, NEXT_PUBLIC_APP_URL: 'https://other.example.com' })).toMatch(
      /NEXT_PUBLIC_APP_URL/,
    );
    expect(issuesOf(without('NEXT_PUBLIC_APP_URL'))).toMatch(/NEXT_PUBLIC_APP_URL/);
  });

  it('refuses a non-https or local public URL on Vercel', () => {
    expect(issuesOf({ ...production, APP_URL: 'http://auren.example.com' })).toMatch(/https/);
    expect(issuesOf({ ...production, APP_URL: 'http://localhost:3000', VERCEL: '1' })).toMatch(
      /https/,
    );
  });

  it.each([
    'dev-only-secret-change-me-0123456789abcdef',
    'ci-secret-0123456789abcdef0123456789abcdef',
    'test-secret-0123456789abcdef0123456789abcdef',
    'x'.repeat(40),
    'abababababababababababababababab',
    'Please-change-me-to-something-else-now-1',
    'abcdefghijklmnopqrstuvwxyz012345',
    'auren-dev-Zk2vN9xRw4TbYh8LmC3sPd6JfGa1Ue',
    'k7Q2v9XrT4bYh8LmC3sPd6JfGa1UeVn5xxxxxxxxxx',
  ])('refuses the weak or example secret %s', (secret) => {
    expect(issuesOf({ ...production, BETTER_AUTH_SECRET: secret })).toMatch(/BETTER_AUTH_SECRET/);
  });

  it('allows missing Upstash configuration by default, refuses if STRICT_REDIS_GUARD=1', () => {
    const source = without('UPSTASH_REDIS_REST_URL');
    delete source.UPSTASH_REDIS_REST_TOKEN;
    expect(issuesOf(source)).toBe('');
    expect(issuesOf({ ...source, STRICT_REDIS_GUARD: '1' })).toMatch(/Upstash Redis is required/);
  });

  it('allows missing Inngest keys by default, refuses if STRICT_INNGEST_GUARD=1 or dev mode is active', () => {
    const source = without('INNGEST_SIGNING_KEY');
    delete source.INNGEST_EVENT_KEY;
    expect(issuesOf(source)).toBe('');
    expect(issuesOf({ ...source, STRICT_INNGEST_GUARD: '1' })).toMatch(
      /INNGEST_SIGNING_KEY: is required/,
    );
    expect(issuesOf({ ...production, INNGEST_DEV: '1' })).toMatch(/INNGEST_DEV/);
  });

  it('refuses an Inngest base URL override', () => {
    expect(issuesOf({ ...production, INNGEST_BASE_URL: 'https://evil.example.com' })).toMatch(
      /INNGEST_BASE_URL/,
    );
  });

  it('allows a deployment without an email provider by default, refuses local SMTP or placeholder domain if configured', () => {
    expect(issuesOf(without('RESEND_API_KEY'))).toBe('');
    expect(issuesOf({ ...without('RESEND_API_KEY'), STRICT_EMAIL_GUARD: '1' })).toMatch(
      /email provider/,
    );
    expect(issuesOf({ ...without('RESEND_API_KEY'), SMTP_URL: 'smtp://localhost:1025' })).toMatch(
      /must not point to a local host/,
    );
    expect(issuesOf({ ...without('RESEND_API_KEY'), SMTP_URL: 'smtp://mailpit:1025' })).toMatch(
      /must not point to a local host/,
    );
    expect(
      issuesOf({ ...without('RESEND_API_KEY'), SMTP_URL: 'smtp://smtp.example.com:587' }),
    ).toBe('');
  });

  it('refuses a placeholder sender domain when an email provider is configured', () => {
    expect(issuesOf({ ...production, EMAIL_FROM: 'AUREN <no-reply@auren.local>' })).toMatch(
      /EMAIL_FROM/,
    );
  });

  it('refuses unknown or disabled proxy trust off Vercel, accepts the Vercel default', () => {
    expect(issuesOf(without('TRUSTED_PROXY'))).toMatch(/TRUSTED_PROXY: must be set/);
    expect(issuesOf({ ...production, TRUSTED_PROXY: 'none' })).toMatch(/must not be `none`/);
    expect(issuesOf({ ...production, TRUSTED_PROXY: 'forwarded' })).toMatch(
      /must not be `forwarded`/,
    );
    expect(issuesOf({ ...production, TRUSTED_PROXY: 'hops:2' })).toBe('');
    expect(issuesOf({ ...production, TRUSTED_PROXY: 'vercel' })).toBe('');
    expect(issuesOf({ ...production, TRUSTED_PROXY: 'hops:0' })).toMatch(/TRUSTED_PROXY must be/);
    expect(issuesOf({ ...without('TRUSTED_PROXY'), VERCEL: '1' })).toBe('');
  });

  it('lists every problem at once', () => {
    const issues = issuesOf({
      NODE_ENV: 'production',
      ...{ DATABASE_URL: production.DATABASE_URL },
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      APP_URL: 'https://auren.example.com',
    });
    expect(issues.split('\n').length).toBeGreaterThanOrEqual(5);
  });
});

describe('production database and media settings (Supabase, Vercel Blob)', () => {
  it('needs a direct URL that differs from the pooled runtime URL', () => {
    expect(issuesOf(without('DIRECT_URL'))).toMatch(/DIRECT_URL: is required/);
    expect(issuesOf({ ...production, DIRECT_URL: production.DATABASE_URL })).toMatch(
      /DIRECT_URL: must differ from DATABASE_URL/,
    );
  });

  it('requires TLS on both connections and refuses local databases', () => {
    const noTls = 'postgresql://u:p@db.proj.supabase.co:5432/postgres';
    expect(issuesOf({ ...production, DIRECT_URL: noTls })).toMatch(/DIRECT_URL: must require TLS/);
    expect(
      issuesOf({
        ...production,
        DATABASE_URL: noTls.replace('db.proj', 'aws-0.pooler').replace(':5432', ':6543'),
      }),
    ).toMatch(/DATABASE_URL: must require TLS/);
    expect(
      issuesOf({
        ...production,
        DIRECT_URL: 'postgresql://u:p@localhost:5432/auren?sslmode=require',
      }),
    ).toMatch(/must not point at a local database/);
    for (const mode of ['sslmode=verify-full', 'sslmode=verify-ca', 'ssl=true']) {
      expect(
        issuesOf({
          ...production,
          DIRECT_URL: `postgresql://u:p@db.proj.supabase.co:5432/postgres?${mode}`,
        }),
      ).toBe('');
    }
  });

  it('uses the transaction pooler at runtime and a direct connection for migrations', () => {
    expect(
      issuesOf({
        ...production,
        DATABASE_URL: 'postgresql://u:p@db.proj.supabase.co:5432/postgres?sslmode=require',
      }),
    ).toMatch(/DATABASE_URL: must use the Supabase transaction pooler/);
    expect(
      issuesOf({
        ...production,
        DIRECT_URL: 'postgresql://u:p@aws-0.pooler.supabase.com:6543/postgres?sslmode=require',
      }),
    ).toMatch(/DIRECT_URL: must be the direct or session connection/);
  });

  it('keeps the per-instance pool small', () => {
    expect(issuesOf({ ...production, DB_POOL_MAX: '40' })).toMatch(/DB_POOL_MAX/);
    expect(issuesOf({ ...production, DB_POOL_MAX: '3' })).toBe('');
  });

  it('requires the Vercel Blob token', () => {
    expect(issuesOf(without('BLOB_READ_WRITE_TOKEN'))).toMatch(
      /BLOB_READ_WRITE_TOKEN: is required/,
    );
  });
});

describe('local production runs and builds', () => {
  const local = {
    LOCAL_PRODUCTION: '1',
    NODE_ENV: 'production',
    APP_URL: 'http://localhost:3210',
    DATABASE_URL: production.DATABASE_URL,
    BETTER_AUTH_SECRET: 'e2e-secret-0123456789abcdef0123456789abcdef',
  };

  it('lets an explicit localhost APP_URL run a production build without services', () => {
    expect(issuesOf(local)).toBe('');
  });

  it('does not exempt a bare localhost APP_URL without the explicit opt-in', () => {
    const { LOCAL_PRODUCTION: _omit, ...rest } = local;
    expect(issuesOf(rest)).toMatch(/BLOB_READ_WRITE_TOKEN/);
  });

  it('does not treat a missing APP_URL as local', () => {
    const { APP_URL: _omit, ...rest } = local;
    expect(issuesOf(rest)).toMatch(/APP_URL/);
  });

  it('never treats Vercel as local', () => {
    expect(issuesOf({ ...local, VERCEL: '1' })).toMatch(/APP_URL: must be an https URL/);
  });

  it('skips the production guards during the build phase only', () => {
    const build = {
      NODE_ENV: 'production',
      DATABASE_URL: production.DATABASE_URL,
      BETTER_AUTH_SECRET: 'ci-secret-0123456789abcdef0123456789abcdef',
    };
    expect(issuesOf(build)).not.toBe('');
    expect(issuesOf({ ...build, NEXT_PHASE: 'phase-production-build' })).toBe('');
  });

  it('allows ALLOW_INCOMPLETE_ENV=1 or STRICT_ENV_GUARDS=0 to bypass external services requirement on Vercel', () => {
    const minimalVercel = {
      NODE_ENV: 'production',
      VERCEL: '1',
      APP_URL: 'https://aurenbd.vercel.app',
      NEXT_PUBLIC_APP_URL: 'https://aurenbd.vercel.app',
      DATABASE_URL: production.DATABASE_URL,
      BETTER_AUTH_SECRET: STRONG_SECRET,
      ALLOW_INCOMPLETE_ENV: '1',
    };
    expect(issuesOf(minimalVercel)).toBe('');
    expect(
      issuesOf({ ...minimalVercel, ALLOW_INCOMPLETE_ENV: undefined, STRICT_ENV_GUARDS: '0' }),
    ).toBe('');
  });
});

describe('SKIP_ENV_VALIDATION', () => {
  it('is honoured for tooling and the build, never by a production server', () => {
    expect(skipsEnvValidation({ SKIP_ENV_VALIDATION: '1' })).toBe(true);
    expect(skipsEnvValidation({ SKIP_ENV_VALIDATION: '1', NODE_ENV: 'development' })).toBe(true);
    expect(
      skipsEnvValidation({
        SKIP_ENV_VALIDATION: '1',
        NODE_ENV: 'production',
        NEXT_PHASE: 'phase-production-build',
      }),
    ).toBe(true);
    expect(skipsEnvValidation({ SKIP_ENV_VALIDATION: '1', NODE_ENV: 'production' })).toBe(false);
    expect(
      skipsEnvValidation({
        SKIP_ENV_VALIDATION: '1',
        NODE_ENV: 'production',
        NEXT_PHASE: 'phase-production-server',
      }),
    ).toBe(false);
    expect(skipsEnvValidation({ NODE_ENV: 'development' })).toBe(false);
  });
});

describe('secret strength helpers', () => {
  it('measures entropy', () => {
    expect(entropyBitsPerChar('')).toBe(0);
    expect(entropyBitsPerChar('aaaa')).toBe(0);
    expect(entropyBitsPerChar('abcd')).toBeCloseTo(2, 5);
  });

  it('accepts a random base64 secret and explains rejections', () => {
    expect(weakSecretReason(STRONG_SECRET)).toBeNull();
    expect(weakSecretReason('a3f9c1e7b20d4856f1a9c3e7d2b04816')).toBeNull();
    expect(weakSecretReason('short')).toMatch(/shorter/);
    expect(weakSecretReason('aAbBcCdD'.repeat(5))).toMatch(/few distinct|entropy|sequential/);
  });
});

describe('secret rotation list', () => {
  const next = 'p4Wd8sKz1xQv7BnC2mLr9TyHj5GfEa3U';
  const old = 'Zk2vN9xRw4TbYh8LmC3sPd6JfGa1UeVn5oXiK0yHc=';

  it('accepts a versioned list of strong secrets', () => {
    expect(issuesOf({ ...production, BETTER_AUTH_SECRETS: `2:${next},1:${old}` })).toBe('');
  });

  it('rejects a malformed list and a weak entry in production', () => {
    expect(issuesOf({ ...production, BETTER_AUTH_SECRETS: 'oops' })).toMatch(/BETTER_AUTH_SECRETS/);
    expect(
      issuesOf({
        ...production,
        BETTER_AUTH_SECRETS: `2:${next},1:ci-secret-0123456789abcdef0123456789abcdef`,
      }),
    ).toMatch(/BETTER_AUTH_SECRETS: contains a secret/);
  });
});

describe('local-only bootstrap values in production', () => {
  it('rejects SEED_DEMO_ADMIN', () => {
    expect(issuesOf({ ...production, SEED_DEMO_ADMIN: '1' })).toMatch(/SEED_DEMO_ADMIN/);
  });

  it('rejects SEED_OWNER_PASSWORD', () => {
    expect(issuesOf({ ...production, SEED_OWNER_PASSWORD: 'anything-at-all' })).toMatch(
      /SEED_OWNER_PASSWORD: must not be set in production/,
    );
  });

  it('ignores blank values', () => {
    expect(issuesOf({ ...production, SEED_DEMO_ADMIN: '', SEED_OWNER_PASSWORD: ' ' })).toBe('');
  });
});
