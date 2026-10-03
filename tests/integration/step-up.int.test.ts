import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: new Map<string, string>(),
}));

vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) =>
      request.cookies.has(name) ? { name, value: request.cookies.get(name) } : undefined,
    set: (name: string, value: string) => void request.cookies.set(name, value),
    delete: (name: string) => void request.cookies.delete(name),
  }),
}));

import { resetAttemptMemory } from '@/lib/attempts';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { resetMemoryLimits } from '@/lib/rate-limit';
import { requireStaff } from '@/lib/staff';
import { STEP_UP_COOKIE, requireStepUp } from '@/lib/step-up';
import { confirmStepUp, signOutEverywhere } from '@/modules/identity/actions';
import { TEST_PASSWORD, makeCustomer, makeStaff } from '../factories';
import { totp, totpSecretOf } from '../support/totp';
import { closeDatabase, resetDatabase } from './helpers';

const PURPOSE = 'orders.refund';

beforeEach(async () => {
  await resetDatabase();
  resetMemoryLimits();
  resetAttemptMemory();
  request.cookies.clear();
  request.headers = new Headers();
});
afterEach(() => vi.useRealTimers());
afterAll(closeDatabase);

/** A fully set up staff member (two-factor on) holding a real session. */
async function signedInStaff() {
  const staff = await makeStaff({ role: 'finance', twoFactor: false });
  const response = await auth.api.signInEmail({
    body: { email: staff.email, password: TEST_PASSWORD },
    returnHeaders: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  await db.user.update({ where: { id: staff.user.id }, data: { twoFactorEnabled: true } });
  request.headers = new Headers({ cookie });
  return { ...staff, cookie };
}

describe('step-up for sensitive staff actions', () => {
  it('blocks a signed-in staff member until they re-enter their password', async () => {
    await signedInStaff();
    const staff = await requireStaff();
    await expect(requireStepUp(staff, PURPOSE)).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' });

    const result = await confirmStepUp({
      method: 'password',
      purpose: PURPOSE,
      password: TEST_PASSWORD,
    });
    expect(result).toMatchObject({ ok: true, data: { validForSeconds: 300 } });
    expect(request.cookies.has(STEP_UP_COOKIE)).toBe(true);
    await expect(requireStepUp(staff, PURPOSE)).resolves.toBeUndefined();

    const trail = await db.auditLog.findMany({ where: { action: 'staff.step_up' } });
    expect(trail).toHaveLength(1);
    expect(JSON.stringify(trail[0])).not.toContain(TEST_PASSWORD);
  });

  it('refuses a wrong password and an invalid authenticator code', async () => {
    await signedInStaff();
    const staff = await requireStaff();
    expect(
      await confirmStepUp({ method: 'password', purpose: PURPOSE, password: 'Not-the-password-1' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
    expect(await confirmStepUp({ method: 'totp', purpose: PURPOSE, code: '123456' })).toMatchObject(
      {
        ok: false,
        error: { code: 'UNAUTHENTICATED' },
      },
    );
    await expect(requireStepUp(staff, PURPOSE)).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' });
  });

  it('validates input strictly', async () => {
    await signedInStaff();
    expect(
      await confirmStepUp({ method: 'password', purpose: PURPOSE, password: 'x', extra: true }),
    ).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });
    expect(await confirmStepUp({ method: 'totp', purpose: PURPOSE, code: 'abc' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });
    expect(await confirmStepUp({ method: 'sms' })).toMatchObject({ ok: false });
  });

  it('expires after five minutes', async () => {
    await signedInStaff();
    const staff = await requireStaff();
    await confirmStepUp({ method: 'password', purpose: PURPOSE, password: TEST_PASSWORD });
    await expect(requireStepUp(staff, PURPOSE)).resolves.toBeUndefined();

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 6 * 60 * 1000 });
    await expect(requireStepUp(staff, PURPOSE)).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' });
  });

  it('does not carry over to another session of the same user', async () => {
    const first = await signedInStaff();
    const staff = await requireStaff();
    await confirmStepUp({ method: 'password', purpose: PURPOSE, password: TEST_PASSWORD });
    const token = request.cookies.get(STEP_UP_COOKIE)!;

    const second = await auth.api.signInEmail({
      body: { email: first.email, password: TEST_PASSWORD },
      returnHeaders: true,
    });
    request.headers = new Headers({
      cookie: second.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    });
    request.cookies.set(STEP_UP_COOKIE, token);
    await expect(requireStepUp(staff, PURPOSE)).rejects.toMatchObject({ code: 'STEP_UP_REQUIRED' });
  });

  it('delays further tries after a few wrong answers, counts only failures, and recovers', async () => {
    await signedInStaff();
    const outcomes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const result = await confirmStepUp({
        method: 'password',
        purpose: PURPOSE,
        password: `Wrong-guess-${i}-xx`,
      });
      outcomes.push(result.ok ? 'ok' : result.error.code);
    }
    expect(outcomes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHENTICATED',
      'UNAUTHENTICATED',
      'RATE_LIMITED',
      'RATE_LIMITED',
      'RATE_LIMITED',
    ]);
    // Even the right password is refused while the delay holds, and the refusal is audited.
    expect(
      await confirmStepUp({ method: 'password', purpose: PURPOSE, password: TEST_PASSWORD }),
    ).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
    expect(await db.auditLog.count({ where: { action: 'staff.step_up_blocked' } })).toBeGreaterThan(
      0,
    );
    expect(await db.auditLog.count({ where: { action: 'staff.step_up_failed' } })).toBe(3);

    // After the delay the right password works and the counter starts again from zero.
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60_000 });
    expect(
      await confirmStepUp({ method: 'password', purpose: PURPOSE, password: TEST_PASSWORD }),
    ).toMatchObject({ ok: true });
    for (let i = 0; i < 4; i++) {
      expect(
        await confirmStepUp({ method: 'password', purpose: PURPOSE, password: TEST_PASSWORD }),
      ).toMatchObject({ ok: true });
    }
  });

  it('is scoped to one purpose', async () => {
    await signedInStaff();
    const staff = await requireStaff();
    await confirmStepUp({ method: 'password', purpose: 'orders.refund', password: TEST_PASSWORD });
    await expect(requireStepUp(staff, 'orders.refund')).resolves.toBeUndefined();
    await expect(requireStepUp(staff, 'customers.export')).rejects.toMatchObject({
      code: 'STEP_UP_REQUIRED',
    });
    expect(await confirmStepUp({ method: 'password', password: TEST_PASSWORD })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });
    expect(
      await confirmStepUp({
        method: 'password',
        purpose: 'Not A Purpose',
        password: TEST_PASSWORD,
      }),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('accepts a valid authenticator code and refuses a stale one', async () => {
    const staffAccount = await makeStaff({ role: 'finance', twoFactor: false });
    const signIn = await auth.api.signInEmail({
      body: { email: staffAccount.email, password: TEST_PASSWORD },
      returnHeaders: true,
    });
    const headers = new Headers({
      cookie: signIn.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    });
    const enrol = await auth.api.enableTwoFactor({
      headers,
      body: { password: TEST_PASSWORD, method: 'totp' },
    });
    const secret = totpSecretOf(enrol);
    const verified = await auth.api.verifyTOTP({
      headers,
      body: { code: totp(secret) },
      returnHeaders: true,
    });
    // Enrolling can replace the session: use whichever cookie the server issued last.
    const issued = verified.headers.getSetCookie().map((c) => c.split(';')[0]);
    request.headers = new Headers({
      cookie: issued.length > 0 ? issued.join('; ') : headers.get('cookie')!,
    });
    await db.user.update({ where: { id: staffAccount.user.id }, data: { twoFactorEnabled: true } });

    expect(
      await confirmStepUp({ method: 'totp', purpose: PURPOSE, code: totp(secret) }),
    ).toMatchObject({ ok: true });
    expect(
      await confirmStepUp({
        method: 'totp',
        purpose: PURPOSE,
        code: totp(secret, Date.now() - 10 * 60 * 1000),
      }),
    ).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('is only for staff', async () => {
    const customer = await makeCustomer();
    const response = await auth.api.signInEmail({
      body: { email: customer.email, password: TEST_PASSWORD },
      returnHeaders: true,
    });
    request.headers = new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    });
    expect(
      await confirmStepUp({ method: 'password', purpose: PURPOSE, password: TEST_PASSWORD }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });
});

describe('sign out everywhere', () => {
  it('ends every session of the account and leaves an audit entry for staff', async () => {
    const staff = await signedInStaff();
    await (await auth.$context).internalAdapter.createSession(staff.user.id);
    expect(await db.session.count({ where: { userId: staff.user.id } })).toBe(2);

    expect(await signOutEverywhere()).toEqual({ ok: true, data: { signedOut: true } });

    expect(await db.session.count({ where: { userId: staff.user.id } })).toBe(0);
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: staff.cookie }) }),
    ).toBeNull();
    expect(await db.auditLog.count({ where: { action: 'staff.sessions_revoked' } })).toBe(1);
  });

  it('requires a session', async () => {
    expect(await signOutEverywhere()).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
  });
});
