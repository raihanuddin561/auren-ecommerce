import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { auth, getSession, requireUser } from '../auth';
import { clearLoggedEmails, getLoggedEmails, pickTransport, sendEmail } from '../email';
import { resetPasswordMessage, verifyEmailMessage } from '@/emails/auth';

const signedIn = (overrides: Record<string, unknown> = {}) => ({
  session: { id: 's1' },
  user: { id: 'u1', email: 'a@b.com', banned: false, role: 'customer', ...overrides },
});

describe('auth configuration', () => {
  it('requires verified email, long passwords and short-lived reset links', () => {
    const { emailAndPassword, emailVerification } = auth.options;
    expect(emailAndPassword?.enabled).toBe(true);
    expect(emailAndPassword?.requireEmailVerification).toBe(true);
    expect(emailAndPassword?.minPasswordLength).toBeGreaterThanOrEqual(10);
    expect(emailAndPassword?.resetPasswordTokenExpiresIn).toBeLessThanOrEqual(3600);
    expect(emailVerification?.sendOnSignUp).toBe(true);
    expect(emailVerification?.expiresIn).toBeLessThanOrEqual(3600);
  });

  it('keeps social account linking off and rate limits credential endpoints', () => {
    expect(auth.options.account?.accountLinking?.enabled).toBe(false);
    const rules = auth.options.rateLimit?.customRules ?? {};
    expect(Object.keys(rules)).toEqual(
      expect.arrayContaining([
        '/sign-in/email',
        '/request-password-reset',
        '/two-factor/verify-totp',
      ]),
    );
    expect(auth.options.emailVerification?.autoSignInAfterVerification).toBe(false);
  });

  it('refuses to attach a social login to a staff user', async () => {
    const { db } = await import('../db');
    const find = vi.spyOn(db.staffMember, 'findUnique');
    const hook = auth.options.databaseHooks?.account?.create?.before;
    const account = { userId: 'u1', providerId: 'google', accountId: 'g1' } as never;
    find.mockResolvedValueOnce({ id: 'm1' } as never);
    expect(await hook?.(account)).toBe(false);
    find.mockResolvedValueOnce(null as never);
    expect(await hook?.(account)).toEqual({ data: account });
    expect(
      await hook?.({ ...(account as object), providerId: 'credential' } as never),
    ).toMatchObject({
      data: { providerId: 'credential' },
    });
  });

  it('enables Google only when credentials are configured', () => {
    expect(auth.options.socialProviders).toEqual({});
  });

  it('registers the two-factor plugin used to enforce staff TOTP', () => {
    const ids = (auth.options.plugins ?? []).map((plugin) => plugin.id);
    expect(ids).toContain('two-factor');
    expect(ids.at(-1)).toBe('next-cookies');
  });
});

describe('session helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the session for a signed-in request', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(signedIn() as never);
    const user = await requireUser();
    expect(user.id).toBe('u1');
  });

  it('redirects anonymous visitors to the sign-in page', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(null as never);
    await expect(requireUser()).rejects.toMatchObject({
      digest: expect.stringContaining('/login'),
    });
  });

  it('treats a blocked customer as signed out', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(signedIn({ banned: true }) as never);
    await expect(requireUser()).rejects.toMatchObject({
      digest: expect.stringContaining('/login'),
    });
  });

  it('getSession exposes null when nobody is signed in', async () => {
    vi.spyOn(auth.api, 'getSession').mockResolvedValue(null as never);
    expect(await getSession()).toBeNull();
  });
});

describe('email', () => {
  beforeEach(() => clearLoggedEmails());

  it('prefers Resend, then SMTP, then log-only', () => {
    expect(pickTransport({ RESEND_API_KEY: 're_1', SMTP_URL: 'smtp://x' })).toBe('resend');
    expect(pickTransport({ SMTP_URL: 'smtp://localhost:1025' })).toBe('smtp');
    expect(pickTransport({})).toBe('log');
  });

  it('records messages in memory when no provider is configured', async () => {
    await sendEmail({ to: 'a@b.com', subject: 'Hello', text: 'Body' });
    expect(getLoggedEmails()).toEqual([{ to: 'a@b.com', subject: 'Hello', text: 'Body' }]);
  });

  it('builds verification and reset messages that contain the link once, escaped in HTML', () => {
    const url = 'http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2F';
    const verify = verifyEmailMessage({ name: 'Rahim Uddin', url });
    expect(verify.text).toContain(url);
    expect(verify.html).toContain('token=abc&amp;callbackURL');
    expect(verify.text).toContain('Rahim');

    const reset = resetPasswordMessage({ name: '', url });
    expect(reset.subject).toMatch(/reset/i);
    expect(reset.text).toContain('Hello there');
  });

  it('escapes hostile names in HTML output', () => {
    const { html } = verifyEmailMessage({ name: '<script>alert(1)</script>', url: 'http://x' });
    expect(html).not.toContain('<script>');
  });
});
