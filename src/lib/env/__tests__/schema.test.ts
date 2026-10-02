import { describe, expect, it } from 'vitest';
import { EnvValidationError, describeServices, parseClientEnv, parseServerEnv } from '../schema';

const base = {
  DATABASE_URL: 'postgresql://auren:auren@localhost:5432/auren',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

describe('server env', () => {
  it('accepts the minimum required variables and applies defaults', () => {
    const env = parseServerEnv(base);
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.NODE_ENV).toBe('development');
    expect(describeServices(env)).toMatchObject({ googleAuth: false, redis: false, sentry: false });
  });

  it('fails with a readable list when required variables are missing', () => {
    expect(() => parseServerEnv({})).toThrow(EnvValidationError);
    try {
      parseServerEnv({});
    } catch (error) {
      const issues = (error as EnvValidationError).issues.join('\n');
      expect(issues).toContain('DATABASE_URL');
      expect(issues).toContain('BETTER_AUTH_SECRET');
    }
  });

  it('rejects a short auth secret and a non-postgres database URL', () => {
    expect(() => parseServerEnv({ ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(/32 characters/);
    expect(() => parseServerEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /postgresql/,
    );
  });

  it('treats blank optional values as unset', () => {
    const env = parseServerEnv({ ...base, SENTRY_DSN: '', GOOGLE_CLIENT_ID: '  ', DIRECT_URL: '' });
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.DIRECT_URL).toBeUndefined();
  });

  it('requires grouped variables together', () => {
    expect(() => parseServerEnv({ ...base, GOOGLE_CLIENT_ID: 'id' })).toThrow(
      /GOOGLE_CLIENT_SECRET/,
    );
    expect(() =>
      parseServerEnv({ ...base, UPSTASH_REDIS_REST_URL: 'https://r.upstash.io' }),
    ).toThrow(/UPSTASH_REDIS_REST_TOKEN/);
    const ok = parseServerEnv({
      ...base,
      UPSTASH_REDIS_REST_URL: 'https://r.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    expect(describeServices(ok).redis).toBe(true);
  });

  it('rejects a development placeholder secret when serving a real domain in production', () => {
    const secret = `dev-${'x'.repeat(40)}`;
    const production = { ...base, BETTER_AUTH_SECRET: secret, NODE_ENV: 'production' };
    expect(() => parseServerEnv({ ...production, APP_URL: 'https://auren.com.bd' })).toThrow(
      /placeholder/,
    );
    // a local production build (next build && next start) may keep the placeholder
    expect(parseServerEnv(production).BETTER_AUTH_SECRET).toBe(secret);
    expect(parseServerEnv({ ...base, BETTER_AUTH_SECRET: secret }).BETTER_AUTH_SECRET).toBe(secret);
  });

  it('bounds the database pool size', () => {
    expect(parseServerEnv(base).DB_POOL_MAX).toBe(10);
    expect(parseServerEnv({ ...base, DB_POOL_MAX: '3' }).DB_POOL_MAX).toBe(3);
    expect(() => parseServerEnv({ ...base, DB_POOL_MAX: '0' })).toThrow(EnvValidationError);
  });
});

describe('client env', () => {
  it('defaults the public app URL', () => {
    expect(parseClientEnv({}).NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('rejects an invalid public URL', () => {
    expect(() => parseClientEnv({ NEXT_PUBLIC_APP_URL: 'not a url' })).toThrow(EnvValidationError);
  });
});
