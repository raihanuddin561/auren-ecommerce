import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthReport } from '@/lib/health';

const runHealthChecks = vi.fn<() => Promise<HealthReport>>();
vi.mock('@/lib/health.server', () => ({ runHealthChecks: () => runHealthChecks() }));
vi.mock('next/server', () => ({ connection: async () => undefined }));

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
  beforeEach(() => runHealthChecks.mockReset());

  it('answers 200 with the report when everything works, and is never cached', async () => {
    runHealthChecks.mockResolvedValue(report('ok'));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      status: 'ok',
      checks: { redis: { status: 'skipped' } },
    });
  });

  it('answers 200 when degraded so a Redis blip does not page anyone at night', async () => {
    runHealthChecks.mockResolvedValue(report('degraded'));
    expect((await GET()).status).toBe(200);
  });

  it('answers 503 when the database is down so the uptime monitor alerts', async () => {
    runHealthChecks.mockResolvedValue(report('down'));
    expect((await GET()).status).toBe(503);
  });
});
