import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadClient(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.doMock('../../env', () => ({ env, isProduction: env.NODE_ENV === 'production' }));
  return (await import('../client')).inngest;
}

afterEach(() => vi.doUnmock('../../env'));

describe('inngest client', () => {
  it('uses cloud mode with explicit signing keys in production', async () => {
    const client = await loadClient({
      NODE_ENV: 'production',
      INNGEST_SIGNING_KEY: 'signkey-prod-0001',
      INNGEST_SIGNING_KEY_FALLBACK: 'signkey-prod-0000',
      INNGEST_EVENT_KEY: 'event-key',
    });
    expect(client.mode).toBe('cloud');
    expect(client.signingKey).toBe('signkey-prod-0001');
    expect(client.signingKeyFallback).toBe('signkey-prod-0000');
  }, 30_000);

  it('uses dev mode outside production', async () => {
    const client = await loadClient({ NODE_ENV: 'development', INNGEST_DEV: '1' });
    expect(client.mode).toBe('dev');
  });
});
