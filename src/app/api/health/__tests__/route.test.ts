import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthReport } from '@/lib/health';

const getCachedHealth = vi.fn<() => Promise<HealthReport>>();
vi.mock('@/lib/health.server', () => ({ getCachedHealth: () => getCachedHealth() }));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('@/lib/env', () => ({ env: { HEALTH_DETAIL_TOKEN: 'monitoring-token-0123456789abcdef' } }));

import { GET } from '../route';

const report = (status: HealthReport['status']): HealthReport => ({
  status,
  checks: {
    database:
      status === 'down'
        ? { status: 'down', latencyMs: 2000, error: 'timeout' }
        : { status: 'ok', latencyMs: 2 },
    redis: { status: 'skipped', reason: 'not configured' },
  },
  version: 'dev',
  uptimeSeconds: 5,
});

describe('GET /api/health', () => {
  beforeEach(() => getCachedHealth.mockReset());

  it('answers 200 with the report when everything works, and is never cached', async () => {
    getCachedHealth.mockResolvedValue(report('ok'));
    const response = await GET(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    // the public answer says nothing about dependencies, latency, version or uptime
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('returns the detailed report only to a caller with the monitoring token', async () => {
    getCachedHealth.mockResolvedValue(report('ok'));
    const withToken = (token: string) =>
      GET(
        new Request('http://localhost/api/health', {
          headers: { authorization: `Bearer ${token}` },
        }),
      );
    expect(await (await withToken('monitoring-token-0123456789abcdef')).json()).toMatchObject({
      status: 'ok',
      checks: { redis: { status: 'skipped' } },
      version: 'dev',
    });
    expect(await (await withToken('wrong-token-0123456789abcdefgh')).json()).toEqual({
      status: 'ok',
    });
    expect(await (await withToken('')).json()).toEqual({ status: 'ok' });
  });

  it('answers 200 when degraded so a Redis blip does not page anyone at night', async () => {
    getCachedHealth.mockResolvedValue(report('degraded'));
    expect((await GET(new Request('http://localhost/api/health'))).status).toBe(200);
  });

  it('answers 503 when the database is down so the uptime monitor alerts', async () => {
    getCachedHealth.mockResolvedValue(report('down'));
    const response = await GET(new Request('http://localhost/api/health'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'down' });
  });
});
