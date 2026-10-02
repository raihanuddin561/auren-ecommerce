import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseServerEnv } from '../env/schema';
import {
  BYPASS_STAFF,
  isStaffBypassAllowed,
  isStaffBypassConfigured,
  staffBypassConfigurationError,
} from '../test-bypass';

const base = {
  DATABASE_URL: 'postgresql://auren:auren@localhost:5432/auren_test',
  BETTER_AUTH_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
};
const local = { E2E_STAFF_BYPASS: '1', APP_URL: 'http://localhost:3211' };

const headers = (values: Record<string, string> = {}) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe('test-only staff bypass configuration', () => {
  it('is off by default', () => {
    expect(isStaffBypassConfigured({})).toBe(false);
    expect(isStaffBypassConfigured({ APP_URL: 'http://localhost:3000' })).toBe(false);
  });

  it('needs the explicit flag value 1', () => {
    for (const E2E_STAFF_BYPASS of ['true', '0', 'yes', '']) {
      expect(isStaffBypassConfigured({ E2E_STAFF_BYPASS, APP_URL: 'http://localhost:3000' })).toBe(
        false,
      );
    }
  });

  it('turns on only with an explicit local APP_URL', () => {
    expect(isStaffBypassConfigured(local)).toBe(true);
    expect(
      isStaffBypassConfigured({ E2E_STAFF_BYPASS: '1', APP_URL: 'http://127.0.0.1:3211' }),
    ).toBe(true);
  });

  it('does not treat a missing or blank APP_URL as local', () => {
    expect(isStaffBypassConfigured({ E2E_STAFF_BYPASS: '1' })).toBe(false);
    expect(isStaffBypassConfigured({ E2E_STAFF_BYPASS: '1', APP_URL: '  ' })).toBe(false);
  });

  it('can never turn on for a real domain', () => {
    for (const APP_URL of [
      'https://auren.example',
      'https://www.auren.com.bd',
      'http://localhost.evil.example',
      'not a url',
    ]) {
      expect(isStaffBypassConfigured({ E2E_STAFF_BYPASS: '1', APP_URL }), APP_URL).toBe(false);
    }
  });

  it('can never turn on on Vercel, even for a localhost-looking URL', () => {
    expect(isStaffBypassConfigured({ ...local, VERCEL_ENV: 'production' })).toBe(false);
    expect(isStaffBypassConfigured({ ...local, VERCEL: '1' })).toBe(false);
  });
});

describe('test-only staff bypass per request', () => {
  it('accepts a direct local request', () => {
    expect(isStaffBypassAllowed(headers({ host: 'localhost:3211' }), local)).toBe(true);
    expect(isStaffBypassAllowed(headers({ host: '127.0.0.1:3211' }), local)).toBe(true);
    expect(isStaffBypassAllowed(headers({ host: '[::1]:3211' }), local)).toBe(true);
  });

  it('refuses a request for any other host', () => {
    expect(isStaffBypassAllowed(headers({ host: 'auren.example' }), local)).toBe(false);
    expect(isStaffBypassAllowed(headers({ host: 'localhost.evil.example' }), local)).toBe(false);
    expect(isStaffBypassAllowed(headers(), local)).toBe(false);
  });

  it('refuses anything that arrived through a proxy, even with a local Host', () => {
    for (const name of ['x-real-ip', 'forwarded', 'x-vercel-id']) {
      expect(
        isStaffBypassAllowed(headers({ host: 'localhost:3211', [name]: '203.0.113.9' }), local),
      ).toBe(false);
    }
  });

  it('accepts the loopback address Next.js adds itself and refuses real client addresses', () => {
    const request = (forwarded: string) =>
      headers({ host: 'localhost:3211', 'x-forwarded-for': forwarded });
    expect(isStaffBypassAllowed(request('::1'), local)).toBe(true);
    expect(isStaffBypassAllowed(request('127.0.0.1'), local)).toBe(true);
    expect(isStaffBypassAllowed(request('::ffff:127.0.0.1'), local)).toBe(true);
    expect(isStaffBypassAllowed(request('203.0.113.9'), local)).toBe(false);
    expect(isStaffBypassAllowed(request('::1, 203.0.113.9'), local)).toBe(false);
  });

  it('refuses everything when the environment is not configured', () => {
    expect(isStaffBypassAllowed(headers({ host: 'localhost:3211' }), {})).toBe(false);
  });

  it('grants an identity with no permissions at all', () => {
    expect(BYPASS_STAFF.permissions.size).toBe(0);
    expect(BYPASS_STAFF.role).not.toBe('owner');
  });
});

describe('startup refuses an unsafe bypass configuration', () => {
  it('accepts an unset flag and a local test configuration', () => {
    expect(staffBypassConfigurationError({})).toBeNull();
    expect(staffBypassConfigurationError({ E2E_STAFF_BYPASS: '' })).toBeNull();
    expect(staffBypassConfigurationError(local)).toBeNull();
  });

  it('rejects missing or non-local URLs, Vercel and malformed values', () => {
    expect(staffBypassConfigurationError({ E2E_STAFF_BYPASS: '1' })).toMatch(/localhost/);
    expect(
      staffBypassConfigurationError({ E2E_STAFF_BYPASS: '1', APP_URL: 'https://auren.example' }),
    ).toMatch(/localhost/);
    expect(staffBypassConfigurationError({ ...local, VERCEL_ENV: 'preview' })).toMatch(/Vercel/);
    expect(staffBypassConfigurationError({ E2E_STAFF_BYPASS: 'yes' })).toMatch(/unset or "1"/);
  });

  it('makes the whole server environment fail to parse', () => {
    expect(() =>
      parseServerEnv({ ...base, APP_URL: 'https://auren.example', E2E_STAFF_BYPASS: '1' }),
    ).toThrow(EnvValidationError);
    expect(() => parseServerEnv({ ...base, E2E_STAFF_BYPASS: '1' })).toThrow(EnvValidationError);
    expect(() =>
      parseServerEnv({ ...base, APP_URL: 'http://localhost:3000', E2E_STAFF_BYPASS: '1' }),
    ).not.toThrow();
  });
});
