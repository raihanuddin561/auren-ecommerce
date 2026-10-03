import { expect, test } from '@playwright/test';

// *.local.spec.ts runs only against the local server: it would lock out a real address on a preview.
// Each attempt uses its own account, so the per-account limit does not interfere between projects.
const uniqueEmail = () => `nobody-${Math.random().toString(36).slice(2, 10)}@auren.test`;

test.describe('auth rate limiting', () => {
  test('answers the sixth sign-in attempt from one address with 429 and Retry-After', async ({
    request,
  }) => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const statuses: number[] = [];
    let blocked: Awaited<ReturnType<typeof request.post>> | undefined;
    for (let i = 0; i < 6; i++) {
      const response = await request.post('/api/auth/sign-in/email', {
        data: { email: uniqueEmail(), password: 'Wrong-password-1' },
        headers: { 'x-forwarded-for': ip },
      });
      statuses.push(response.status());
      if (response.status() === 429) blocked = response;
    }
    expect(statuses.slice(0, 5).every((status) => status !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(Number(blocked?.headers()['retry-after'])).toBeGreaterThan(0);
    expect(await blocked?.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  test('a different address is not affected', async ({ request }) => {
    const response = await request.post('/api/auth/sign-in/email', {
      data: { email: uniqueEmail(), password: 'Wrong-password-1' },
      headers: { 'x-forwarded-for': '198.51.100.77' },
    });
    expect(response.status()).not.toBe(429);
  });
});

test.describe('per-account rate limiting', () => {
  test('stops guessing one account from many addresses', async ({ request }) => {
    const email = uniqueEmail();
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const response = await request.post('/api/auth/sign-in/email', {
        data: { email, password: 'Wrong-password-1' },
        headers: { 'x-forwarded-for': `192.0.2.${(i % 250) + 1}` },
      });
      statuses.push(response.status());
    }
    // three wrong passwords are free, then the account must wait whatever the address
    expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
    expect(statuses.slice(3).every((status) => status === 429)).toBe(true);
  });
});
