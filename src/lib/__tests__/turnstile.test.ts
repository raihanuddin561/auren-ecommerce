import { beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('../env', () => ({ env: config.env }));
vi.mock('../logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { turnstileEnabled, verifyTurnstile } from '../turnstile';

const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  delete config.env.TURNSTILE_SECRET_KEY;
  config.env.APP_URL = 'https://auren.example.com';
});

describe('turnstile', () => {
  it('does nothing when it is not configured', async () => {
    const fetchSpy = reply({ success: false });
    expect(turnstileEnabled()).toBe(false);
    expect(await verifyTurnstile(null, null, fetchSpy as never)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe('when configured', () => {
    beforeEach(() => {
      config.env.TURNSTILE_SECRET_KEY = 'turnstile-secret-for-tests';
    });

    it('accepts only a token Cloudflare confirms', async () => {
      expect(turnstileEnabled()).toBe(true);
      const ok = reply({ success: true });
      expect(await verifyTurnstile('token', '203.0.113.5', ok as never)).toBe(true);
      const call = ok.mock.calls[0] as unknown as [string, { body: URLSearchParams }];
      expect(call[0]).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
      expect(call[1].body.get('response')).toBe('token');
      expect(call[1].body.get('remoteip')).toBe('203.0.113.5');
      expect(await verifyTurnstile('token', null, reply({ success: false }) as never)).toBe(false);
    });

    it('refuses a token minted for another hostname', async () => {
      const other = reply({ success: true, hostname: 'evil.example.net' });
      expect(await verifyTurnstile('token', null, other as never)).toBe(false);
      const same = reply({ success: true, hostname: 'auren.example.com' });
      expect(await verifyTurnstile('token', null, same as never)).toBe(true);
    });

    it('refuses a missing, oversized or unconfirmed token without calling Cloudflare', async () => {
      const fetchSpy = reply({ success: true });
      expect(await verifyTurnstile(null, null, fetchSpy as never)).toBe(false);
      expect(await verifyTurnstile('', null, fetchSpy as never)).toBe(false);
      expect(await verifyTurnstile('x'.repeat(3000), null, fetchSpy as never)).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fails closed when Cloudflare cannot be reached or answers badly', async () => {
      const down = vi.fn(async () => {
        throw new Error('network');
      });
      expect(await verifyTurnstile('token', null, down as never)).toBe(false);
      expect(await verifyTurnstile('token', null, reply({}, 500) as never)).toBe(false);
      expect(await verifyTurnstile('token', null, reply({ success: 'true' }) as never)).toBe(false);
    });

    it('does not send an IPv6 /64 label as the client address', async () => {
      const ok = reply({ success: true });
      await verifyTurnstile('token', '2001:db8:0:0::/64', ok as never);
      const call = ok.mock.calls[0] as unknown as [string, { body: URLSearchParams }];
      expect(call[1].body.has('remoteip')).toBe(false);
    });
  });
});
