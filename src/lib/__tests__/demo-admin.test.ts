import { describe, expect, it } from 'vitest';
import { demoAdminConfigurationError, isDemoAdminAllowed } from '../demo-admin';
import { EnvValidationError, parseServerEnv } from '../env/schema';

const local = {
  NODE_ENV: 'development',
  APP_URL: 'http://localhost:3000',
  SEED_DEMO_ADMIN: '1',
};

describe('local demo admin switch', () => {
  it('is honoured on a local development run only', () => {
    expect(isDemoAdminAllowed(local)).toBe(true);
    expect(isDemoAdminAllowed({ ...local, APP_URL: 'http://127.0.0.1:3000' })).toBe(true);
  });

  it('is off unless explicitly set to 1', () => {
    expect(isDemoAdminAllowed({ ...local, SEED_DEMO_ADMIN: undefined })).toBe(false);
    expect(isDemoAdminAllowed({ ...local, SEED_DEMO_ADMIN: 'true' })).toBe(false);
    expect(demoAdminConfigurationError({ ...local, SEED_DEMO_ADMIN: 'true' })).toMatch(/unset or/);
  });

  it('is never honoured in production, even for a local URL', () => {
    expect(isDemoAdminAllowed({ ...local, NODE_ENV: 'production' })).toBe(false);
    expect(isDemoAdminAllowed({ ...local, NODE_ENV: 'production', LOCAL_PRODUCTION: '1' })).toBe(
      false,
    );
  });

  it('requires an explicit localhost APP_URL', () => {
    expect(isDemoAdminAllowed({ ...local, APP_URL: undefined })).toBe(false);
    expect(isDemoAdminAllowed({ ...local, APP_URL: 'https://shop.example.com' })).toBe(false);
    expect(demoAdminConfigurationError({ ...local, APP_URL: 'https://shop.example.com' })).toMatch(
      /localhost/,
    );
  });

  it('refuses a remote database, with or without the remote seed override', () => {
    const remote = 'postgresql://u:p@db.example.supabase.co:5432/postgres';
    expect(isDemoAdminAllowed({ ...local, DATABASE_URL: remote })).toBe(false);
    expect(demoAdminConfigurationError({ ...local, DATABASE_URL: remote })).toMatch(/DATABASE_URL/);
    expect(
      isDemoAdminAllowed({ ...local, DATABASE_URL: 'postgresql://u:p@localhost:5432/auren' }),
    ).toBe(true);
    expect(isDemoAdminAllowed({ ...local, SEED_ALLOW_REMOTE: '1' })).toBe(false);
  });

  it('is never honoured on Vercel', () => {
    expect(isDemoAdminAllowed({ ...local, VERCEL: '1' })).toBe(false);
    expect(demoAdminConfigurationError({ ...local, VERCEL_ENV: 'preview' })).toMatch(/Vercel/);
  });

  it('refuses to boot when set outside a local run', () => {
    const base = {
      DATABASE_URL: 'postgresql://u:p@localhost:5432/auren',
      BETTER_AUTH_SECRET: 'x'.repeat(40),
    };
    expect(() => parseServerEnv({ ...base, ...local })).not.toThrow();
    expect(() =>
      parseServerEnv({ ...base, ...local, APP_URL: 'https://shop.example.com' }),
    ).toThrow(EnvValidationError);
    expect(() => parseServerEnv({ ...base, ...local, NODE_ENV: 'production' })).toThrow(
      /SEED_DEMO_ADMIN/,
    );
  });
});
