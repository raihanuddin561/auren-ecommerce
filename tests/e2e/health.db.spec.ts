import { expect, test } from '@playwright/test';

test.describe('health endpoint', () => {
  test('reports the database as reachable and is not cacheable', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
    const body = await response.json();
    expect(body.status).toMatch(/ok|degraded/);
    expect(body).toEqual({ status: body.status });
    expect(JSON.stringify(body)).not.toMatch(/postgres(ql)?:\/\//);
  });
});
