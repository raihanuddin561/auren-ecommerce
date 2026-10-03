import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

import { POST } from '@/app/api/auth/[...all]/route';
import { resetAttemptMemory } from '@/lib/attempts';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clearLoggedEmails } from '@/lib/email';
import { resetMemoryLimits } from '@/lib/rate-limit';
import { TEST_PASSWORD, makeCustomer, makeStaff } from '../factories';
import { totp, totpSecretOf } from '../support/totp';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  clearLoggedEmails();
  resetMemoryLimits();
  resetAttemptMemory();
});
afterAll(closeDatabase);

let nextOctet = 1;
/** A request from its own address, so the per-address limit does not interfere with the test. */
function call(path: string, body: unknown, headers: Record<string, string> = {}) {
  const ip = `203.0.113.${(nextOctet++ % 250) + 1}`;
  return POST(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers },
      body: JSON.stringify(body),
    }),
  );
}

/** What a client could observe: status and the shape of the answer, not ids or timestamps. */
async function observable(response: Response) {
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  const shape = (value: unknown): unknown =>
    value === null || typeof value !== 'object'
      ? typeof value
      : Array.isArray(value)
        ? value.map(shape)
        : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return { status: response.status, shape: shape(body), code: (body as { code?: string })?.code };
}

describe('account enumeration', () => {
  it('sign-in answers a wrong password and an unknown email identically', async () => {
    const { email } = await makeCustomer();
    const known = await observable(
      await call('sign-in/email', { email, password: 'Wrong-pass-123' }),
    );
    const unknown = await observable(
      await call('sign-in/email', { email: 'nobody@auren.test', password: 'Wrong-pass-123' }),
    );
    expect(known.status).toBe(401);
    expect(unknown).toEqual(known);
  });

  it('password reset answers the same for an existing and an unknown address', async () => {
    const { email } = await makeCustomer();
    const known = await observable(
      await call('request-password-reset', { email, redirectTo: '/reset' }),
    );
    const unknown = await observable(
      await call('request-password-reset', { email: 'nobody@auren.test', redirectTo: '/reset' }),
    );
    expect(known.status).toBe(200);
    expect(unknown).toEqual(known);
  });

  it('sign-up answers the same for a new and an already registered email', async () => {
    const { email } = await makeCustomer();
    const registered = await observable(
      await call('sign-up/email', { email, password: TEST_PASSWORD, name: 'Someone Else' }),
    );
    const fresh = await observable(
      await call('sign-up/email', {
        email: 'brand-new@auren.test',
        password: TEST_PASSWORD,
        name: 'Brand New',
      }),
    );
    expect(registered.status).toBe(fresh.status);
    expect(registered.shape).toEqual(fresh.shape);
    // and it did not take over or duplicate the existing account
    expect(await db.user.count({ where: { email } })).toBe(1);
  });

  it('the per-account delay applies to unknown emails exactly like known ones', async () => {
    const { email } = await makeCustomer();
    for (const target of [email, 'ghost@auren.test']) {
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        statuses.push(
          (await call('sign-in/email', { email: target, password: 'Wrong-pass-1' })).status,
        );
      }
      expect(statuses).toEqual([401, 401, 401, 429]);
    }
  });
});

describe('real sign-in through the route', () => {
  it('lets the right password in after earlier mistakes were cleared by a success', async () => {
    const { email, password } = await makeCustomer();
    expect((await call('sign-in/email', { email, password: 'Wrong-pass-1' })).status).toBe(401);
    expect((await call('sign-in/email', { email, password })).status).toBe(200);
    for (let i = 0; i < 3; i++) {
      expect((await call('sign-in/email', { email, password: 'Wrong-pass-2' })).status).toBe(401);
    }
    // three wrong in a row: the account now has to wait, even for the right password
    expect((await call('sign-in/email', { email, password })).status).toBe(429);
  });
});

describe('second factor guessing', () => {
  it('locks the second factor after repeated wrong codes, even for the right code', async () => {
    const staff = await makeStaff({ role: 'finance', twoFactor: false });
    const first = await auth.api.signInEmail({
      body: { email: staff.email, password: TEST_PASSWORD },
      returnHeaders: true,
    });
    const cookie = (response: { headers: Headers }) =>
      response.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ');
    const session = new Headers({ cookie: cookie(first) });
    const enrol = await auth.api.enableTwoFactor({
      headers: session,
      body: { password: TEST_PASSWORD, method: 'totp' },
    });
    const secret = totpSecretOf(enrol);
    await auth.api.verifyTOTP({ headers: session, body: { code: totp(secret) } });
    // Enrolling may have issued a new session: end every session before signing in again.
    await db.session.deleteMany({ where: { userId: staff.user.id } });

    // Password accepted, second factor challenge issued.
    const challenge = await auth.api.signInEmail({
      body: { email: staff.email, password: TEST_PASSWORD },
      returnHeaders: true,
    });
    expect(challenge.response).toMatchObject({ twoFactorRedirect: true });
    const pending = { cookie: cookie(challenge) };

    const outcomes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await call('two-factor/verify-totp', { code: '000000' }, pending);
      outcomes.push(response.status);
    }
    expect(outcomes.every((status) => status >= 400)).toBe(true);

    const right = await call('two-factor/verify-totp', { code: totp(secret) }, pending);
    expect(right.status).toBeGreaterThanOrEqual(400);
    expect(await db.session.count({ where: { userId: staff.user.id } })).toBe(0);
  });

  it('never grants a trusted-device shortcut, even when the client asks for one', async () => {
    const staff = await makeStaff({ role: 'finance', twoFactor: false });
    const first = await auth.api.signInEmail({
      body: { email: staff.email, password: TEST_PASSWORD },
      returnHeaders: true,
    });
    const session = new Headers({
      cookie: first.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    });
    const enrol = await auth.api.enableTwoFactor({
      headers: session,
      body: { password: TEST_PASSWORD, method: 'totp' },
    });
    const secret = totpSecretOf(enrol);
    await auth.api.verifyTOTP({ headers: session, body: { code: totp(secret) } });
    // Enrolling may have issued a new session: end every session before signing in again.
    await db.session.deleteMany({ where: { userId: staff.user.id } });

    const challenge = await auth.api.signInEmail({
      body: { email: staff.email, password: TEST_PASSWORD },
      returnHeaders: true,
    });
    const verified = await POST(
      new Request('http://localhost:3000/api/auth/two-factor/verify-totp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.200',
          cookie: challenge.headers
            .getSetCookie()
            .map((c) => c.split(';')[0])
            .join('; '),
        },
        body: JSON.stringify({ code: totp(secret), trustDevice: true }),
      }),
    );
    expect(verified.status).toBe(200);
    const issued = verified.headers.getSetCookie().join('\n');
    expect(issued).toContain('session_token');
    expect(issued).not.toContain('trust_device');
    expect(
      await db.verification.count({ where: { identifier: { startsWith: 'trust-device' } } }),
    ).toBe(0);
  });
});
