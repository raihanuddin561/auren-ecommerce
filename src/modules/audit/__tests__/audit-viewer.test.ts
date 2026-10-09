import { describe, expect, it } from 'vitest';
import type { Tx } from '@/lib/db';
import { listAuditLogsForAdmin } from '../repository';

describe('15.5 Audit Log Viewer Repository & Logic', () => {
  it('correctly maps audit rows, joins staff actor names, and calculates pagination', async () => {
    const mockRows = [
      {
        id: '0192e2fb-3000-7000-8000-000000000001',
        actorId: '0192e2fb-3000-7000-8000-000000000099',
        action: 'store.update',
        entityType: 'store_general',
        entityId: 'store-1',
        before: { name: 'Old Auren' },
        after: { name: 'Auren' },
        ip: '103.205.71.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date('2026-10-10T12:00:00Z'),
      },
      {
        id: '0192e2fb-3000-7000-8000-000000000002',
        actorId: null,
        action: 'system.cron',
        entityType: 'security',
        entityId: 'scan-1',
        before: null,
        after: { alerts: 0 },
        ip: null,
        userAgent: null,
        createdAt: new Date('2026-10-10T11:55:00Z'),
      },
    ];

    const mockStaff = [
      {
        id: '0192e2fb-3000-7000-8000-000000000099',
        user: { name: 'Tanvir Hossain', email: 'tanvir@auren.local' },
      },
    ];

    const mockTx = {
      auditLog: {
        count: async () => 2,
        findMany: async (args: { select?: Record<string, boolean> }) => {
          if (args?.select?.entityType) {
            return [{ entityType: 'store_general' }, { entityType: 'security' }];
          }
          if (args?.select?.action) {
            return [{ action: 'store.update' }, { action: 'system.cron' }];
          }
          return mockRows;
        },
      },
      staffMember: {
        findMany: async () => mockStaff,
      },
    } as unknown as Tx;

    const result = await listAuditLogsForAdmin(mockTx, { page: 1, limit: 10 });

    expect(result.totalCount).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(2);

    const first = result.items[0]!;
    expect(first.actorName).toBe('Tanvir Hossain');
    expect(first.actorEmail).toBe('tanvir@auren.local');
    expect(first.action).toBe('store.update');
    expect(first.entityType).toBe('store_general');

    const second = result.items[1]!;
    expect(second.actorName).toBeNull();
    expect(second.actorId).toBeNull();
    expect(second.action).toBe('system.cron');

    expect(result.availableEntityTypes).toEqual(['security', 'store_general']);
    expect(result.availableActions).toEqual(['store.update', 'system.cron']);
  });

  it('clamps pagination boundaries defensively', async () => {
    let capturedSkip = 0;
    let capturedTake = 0;

    const mockTx = {
      auditLog: {
        count: async () => 0,
        findMany: async (args: { skip?: number; take?: number; select?: unknown }) => {
          if (args.skip !== undefined) capturedSkip = args.skip;
          if (args.take !== undefined) capturedTake = args.take;
          return [];
        },
      },
      staffMember: {
        findMany: async () => [],
      },
    } as unknown as Tx;

    const res = await listAuditLogsForAdmin(mockTx, { page: -5, limit: 500 });
    expect(res.page).toBe(1);
    expect(capturedTake).toBe(100); // capped at 100
    expect(capturedSkip).toBe(0);
  });
});
