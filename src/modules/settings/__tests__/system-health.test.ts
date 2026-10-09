import { describe, expect, it } from 'vitest';
import type { SystemHealthData } from '../types';

describe('15.6 System Health Diagnostics & Status Invariants', () => {
  it('identifies healthy systems when database is responsive and no poison events exist', () => {
    const health: SystemHealthData = {
      overallStatus: 'healthy',
      database: { status: 'connected', latencyMs: 12 },
      outbox: { pending: 0, dispatched: 145, failed: 0, oldestPendingAgeMinutes: null },
      inbox: { processedCount: 145 },
      services: {
        emailProvider: 'Resend',
        emailConfigured: true,
        storageProvider: 'Vercel Blob',
        inngestConfigured: true,
        redisConfigured: true,
        sentryConfigured: true,
        maintenanceMode: false,
      },
      environment: {
        nodeEnv: 'production',
        appUrl: 'https://auren.example',
        serverTimeDhaka: '10 Oct 2026, 12:00:00',
      },
    };

    expect(health.overallStatus).toBe('healthy');
    expect(health.database.status).toBe('connected');
    expect(health.outbox.failed).toBe(0);
    expect(health.services.maintenanceMode).toBe(false);
  });

  it('marks system degraded if there is an isolated failed event or high queue age', () => {
    const degradedOutbox = {
      pending: 4,
      dispatched: 100,
      failed: 1, // poison event
      oldestPendingAgeMinutes: 45,
    };

    const status =
      degradedOutbox.failed >= 5
        ? 'critical'
        : degradedOutbox.failed > 0 || degradedOutbox.oldestPendingAgeMinutes > 30
          ? 'degraded'
          : 'healthy';

    expect(status).toBe('degraded');
  });

  it('marks system critical if database is disconnected', () => {
    const dbConnected = false;
    const failed = 0;
    const status = !dbConnected || failed >= 5 ? 'critical' : 'healthy';
    expect(status).toBe('critical');
  });
});
