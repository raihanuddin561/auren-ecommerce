import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { runOnce } from '@/lib/inbox';
import { runIdempotent } from '@/lib/idempotency';
import { handleSampleEvent } from '@/lib/jobs/functions';
import { outboxEventEnvelope } from '@/lib/jobs/client';
import { MAX_DISPATCH_ATTEMPTS, dispatchPendingEvents, enqueueEvent } from '@/lib/outbox';
import { DEFAULT_ROLE_PERMISSIONS, STAFF_ROLES } from '@/lib/permissions';
import { audit, historyFor } from '@/modules/audit/service';
import { closeDatabase, resetDatabase } from './helpers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(resetDatabase);
afterAll(closeDatabase);

describe('database baseline', () => {
  it('creates the extensions the schema relies on', async () => {
    const rows = await db.$queryRaw<Array<{ extname: string }>>`SELECT extname FROM pg_extension`;
    const names = rows.map((row) => row.extname);
    expect(names).toEqual(expect.arrayContaining(['citext', 'pg_trgm']));
  });

  it('generates time-ordered UUIDv7 primary keys', async () => {
    const first = await db.user.create({ data: { name: 'A', email: 'a@auren.test' } });
    const second = await db.user.create({ data: { name: 'B', email: 'b@auren.test' } });
    expect(first.id[14]).toBe('7');
    expect(second.id > first.id).toBe(true);
  });

  it('treats emails as case-insensitive and unique', async () => {
    await db.user.create({ data: { name: 'A', email: 'Rahim@Auren.test' } });
    await expect(
      db.user.create({ data: { name: 'B', email: 'rahim@auren.test' } }),
    ).rejects.toThrow();
  });

  it('stores key/value settings as JSON', async () => {
    await db.storeSetting.create({ data: { key: 'store.name', value: { name: 'AUREN' } } });
    const row = await db.storeSetting.findUniqueOrThrow({ where: { key: 'store.name' } });
    expect(row.value).toEqual({ name: 'AUREN' });
  });

  it('ships the default role grants, including order verification (ADR-015)', async () => {
    const rows = await db.rolePermission.findMany();
    const actual = rows.map((row) => `${row.role}:${row.permission}`).sort();
    const expected = STAFF_ROLES.flatMap((role) =>
      DEFAULT_ROLE_PERMISSIONS[role].map((permission) => `${role}:${permission}`),
    ).sort();
    expect(actual).toEqual(expected);
    const verifiers = rows.filter((row) => row.permission === 'orders.verify').map((r) => r.role);
    expect(verifiers.sort()).toEqual(['admin', 'manager', 'order_verifier', 'owner', 'support']);
  });
});

describe('idempotency keys', () => {
  const options = { key: 'checkout-key-0001', scope: 'checkout.submit', actor: 'user-1' };

  it('runs the work once and replays the stored response afterwards', async () => {
    let runs = 0;
    const work = async () => ({ orderId: `order-${++runs}` });
    const first = await runIdempotent(db, { ...options, request: { total: '1299.00' } }, work);
    const second = await runIdempotent(db, { ...options, request: { total: '1299.00' } }, work);
    expect(first).toEqual({ replayed: false, value: { orderId: 'order-1' } });
    expect(second).toEqual({ replayed: true, value: { orderId: 'order-1' } });
    expect(runs).toBe(1);
  });

  it('executes the work exactly once when eight identical submits race (INV-O6)', async () => {
    let runs = 0;
    const work = async () => {
      runs += 1;
      await sleep(50);
      return { orderId: 'order-race' };
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => runIdempotent(db, { ...options, request: { a: 1 } }, work)),
    );
    expect(runs).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(new Set(results.map((r) => r.value.orderId))).toEqual(new Set(['order-race']));
  });

  it('rejects the same key with a different payload or scope', async () => {
    await runIdempotent(db, { ...options, request: { total: 1 } }, async () => ({ ok: true }));
    await expect(
      runIdempotent(db, { ...options, request: { total: 2 } }, async () => ({ ok: true })),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await expect(
      runIdempotent(
        db,
        { ...options, scope: 'payment.create', request: { total: 1 } },
        async () => ({
          ok: true,
        }),
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('keeps keys private to each actor', async () => {
    const a = await runIdempotent(db, { ...options, actor: 'user-a' }, async () => ({ who: 'a' }));
    const b = await runIdempotent(db, { ...options, actor: 'user-b' }, async () => ({ who: 'b' }));
    expect(a.value).toEqual({ who: 'a' });
    expect(b).toEqual({ replayed: false, value: { who: 'b' } });
  });

  it('rolls the claim back when the work fails, so a retry can succeed', async () => {
    await expect(
      runIdempotent(db, options, async () => {
        throw new Error('stock reservation failed');
      }),
    ).rejects.toThrow('stock reservation failed');
    expect(await db.idempotencyKey.count()).toBe(0);
    const retry = await runIdempotent(db, options, async () => ({ ok: true }));
    expect(retry.replayed).toBe(false);
  });

  it('lets an expired key be claimed again', async () => {
    await runIdempotent(db, { ...options, ttlSeconds: 1 }, async () => ({ n: 1 }));
    await sleep(1_300);
    const again = await runIdempotent(db, { ...options, ttlSeconds: 60 }, async () => ({ n: 2 }));
    expect(again).toEqual({ replayed: false, value: { n: 2 } });
  });

  it('rejects malformed keys', async () => {
    await expect(
      runIdempotent(db, { ...options, key: 'short' }, async () => ({ ok: true })),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('transactional outbox', () => {
  const sample = (message = 'hello') => ({
    type: 'system.sample' as const,
    aggregateType: 'system',
    aggregateId: 's1',
    payload: { message },
  });

  it('persists the event with the state change when the transaction commits', async () => {
    await db.$transaction(async (tx) => {
      await tx.storeSetting.create({ data: { key: 'k', value: {} } });
      await enqueueEvent(tx, sample());
    });
    const rows = await db.outboxEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'system.sample', status: 'pending', attempts: 0 });
  });

  it('writes nothing when the transaction rolls back (INV-O4)', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.storeSetting.create({ data: { key: 'k', value: {} } });
        await enqueueEvent(tx, sample());
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await db.outboxEvent.count()).toBe(0);
    expect(await db.storeSetting.count()).toBe(0);
  });

  it('dispatches each event once and marks it dispatched', async () => {
    await enqueueEvent(db, sample());
    const sent: string[] = [];
    const first = await dispatchPendingEvents(db, async (events) => {
      sent.push(...events.map((e) => e.id));
    });
    const second = await dispatchPendingEvents(db, async (events) => {
      sent.push(...events.map((e) => e.id));
    });
    expect(first).toMatchObject({ leased: 1, dispatched: 1 });
    expect(second.leased).toBe(0);
    expect(sent).toHaveLength(1);
    const row = await db.outboxEvent.findFirstOrThrow();
    expect(row.status).toBe('dispatched');
    expect(row.dispatchedAt).not.toBeNull();
    expect(row.attempts).toBe(1);
  });

  it('never gives the same event to two dispatchers running together', async () => {
    for (let i = 0; i < 20; i++) await enqueueEvent(db, sample(`m${i}`));
    const seen: string[] = [];
    const collect = async (events: Array<{ id: string }>) => {
      seen.push(...events.map((e) => e.id));
      await sleep(20);
    };
    await Promise.all([
      dispatchPendingEvents(db, collect, { limit: 10 }),
      dispatchPendingEvents(db, collect, { limit: 10 }),
      dispatchPendingEvents(db, collect, { limit: 10 }),
    ]);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(20);
  });

  it('keeps a failed send pending with a backoff and the error recorded', async () => {
    await enqueueEvent(db, sample());
    const summary = await dispatchPendingEvents(db, async () => {
      throw new Error('inngest unreachable');
    });
    expect(summary).toMatchObject({ leased: 1, dispatched: 0 });
    const row = await db.outboxEvent.findFirstOrThrow();
    expect(row).toMatchObject({ status: 'pending', attempts: 1, lastError: 'inngest unreachable' });
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
    const retry = await dispatchPendingEvents(db, async () => undefined);
    expect(retry.leased).toBe(0); // backoff has not elapsed
  });

  it('isolates a poison event so its neighbours still go out', async () => {
    await enqueueEvent(db, sample('good'));
    await enqueueEvent(db, sample('poison'));
    const summary = await dispatchPendingEvents(db, async (events) => {
      if (events.some((e) => (e.payload as { message: string }).message === 'poison')) {
        throw new Error('rejected');
      }
    });
    expect(summary).toMatchObject({ leased: 2, dispatched: 1 });
    const byStatus = await db.outboxEvent.groupBy({ by: ['status'], _count: true });
    expect(byStatus.map((g) => g.status).sort()).toEqual(['dispatched', 'pending']);
  });

  it('gives up with a failed status after the maximum attempts, and keeps the row', async () => {
    const id = await enqueueEvent(db, sample());
    await db.outboxEvent.update({ where: { id }, data: { attempts: MAX_DISPATCH_ATTEMPTS } });
    await dispatchPendingEvents(db, async () => undefined);
    const row = await db.outboxEvent.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('failed');
    expect(row.lastError).toMatch(/exhausted/);
  });

  it('refuses to change the content of a stored event', async () => {
    const id = await enqueueEvent(db, sample());
    await expect(
      db.outboxEvent.update({ where: { id }, data: { payload: { message: 'changed' } } }),
    ).rejects.toThrow(/immutable/);
  });

  it('refuses to delete a stored event', async () => {
    const id = await enqueueEvent(db, sample());
    await expect(db.outboxEvent.delete({ where: { id } })).rejects.toThrow(/cannot be deleted/);
  });

  it('refuses to truncate the outbox', async () => {
    await enqueueEvent(db, sample());
    await expect(db.$executeRawUnsafe('TRUNCATE TABLE outbox_events')).rejects.toThrow(
      /append-only/,
    );
  });

  it('delivers the sample event end to end with exactly one effect, even when sent twice (INV-E2)', async () => {
    const id = await enqueueEvent(db, sample('delivered'));
    const row = await db.outboxEvent.findUniqueOrThrow({ where: { id } });
    const envelope = outboxEventEnvelope(row);
    await handleSampleEvent(envelope.data);
    await handleSampleEvent(envelope.data);
    await Promise.all([handleSampleEvent(envelope.data), handleSampleEvent(envelope.data)]);
    const effects = await db.storeSetting.findMany({ where: { key: { startsWith: 'sample:' } } });
    expect(effects).toHaveLength(1);
    expect(effects[0]?.value).toEqual({ message: 'delivered' });
  });

  it('retries a handler after a failure without losing the claim semantics', async () => {
    let attempts = 0;
    const flaky = async () => {
      if (++attempts === 1) throw new Error('database blip');
      return 'done';
    };
    await expect(runOnce(db, 'consumer.a', 'evt-1', flaky)).rejects.toThrow('database blip');
    expect(await db.processedEvent.count()).toBe(0);
    expect(await runOnce(db, 'consumer.a', 'evt-1', flaky)).toEqual({
      executed: true,
      value: 'done',
    });
    expect(await runOnce(db, 'consumer.a', 'evt-1', flaky)).toEqual({ executed: false });
    expect(await runOnce(db, 'consumer.b', 'evt-1', flaky)).toMatchObject({ executed: true });
  });
});

describe('audit log', () => {
  const entry = {
    actorId: null,
    action: 'product.update',
    entity: 'product',
    entityId: 'p-1',
  };

  it('is written in the same transaction as the change (INV-A2)', async () => {
    await db.$transaction(async (tx) => {
      await tx.storeSetting.create({ data: { key: 'tax.rate', value: { bps: 1500 } } });
      await audit(tx, {
        ...entry,
        action: 'setting.update',
        entity: 'setting',
        entityId: 'tax.rate',
        before: null,
        after: { bps: 1500 },
      });
    });
    const rows = await db.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'setting.update',
      entityType: 'setting',
      after: { bps: 1500 },
    });
  });

  it('disappears with the change when the transaction rolls back', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await audit(tx, entry);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await db.auditLog.count()).toBe(0);
  });

  it('stores exact money, redacts secrets and returns newest first', async () => {
    await audit(db, {
      ...entry,
      before: { priceMinor: 100n },
      after: { priceMinor: 9_007_199_254_740_993n, apiKey: 'sk_live' },
    });
    await sleep(5);
    await audit(db, { ...entry, action: 'product.publish', after: { status: 'active' } });
    const history = await historyFor(db, 'product', 'p-1');
    expect(history.map((h) => h.action)).toEqual(['product.publish', 'product.update']);
    expect(history[1]?.after).toEqual({ priceMinor: '9007199254740993', apiKey: '[redacted]' });
  });

  it('cannot be edited', async () => {
    const id = await audit(db, entry);
    await expect(db.auditLog.update({ where: { id }, data: { action: 'x.y' } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('cannot be deleted', async () => {
    const id = await audit(db, entry);
    await expect(db.auditLog.delete({ where: { id } })).rejects.toThrow(/append-only/);
  });

  it('cannot be truncated', async () => {
    await audit(db, entry);
    await expect(db.$executeRawUnsafe('TRUNCATE TABLE audit_logs')).rejects.toThrow(/append-only/);
  });
});

describe('health checks', () => {
  it('reports a reachable database and skips Redis when it is not configured', async () => {
    const { runHealthChecks } = await import('@/lib/health.server');
    const report = await runHealthChecks();
    expect(report.status).toBe('ok');
    expect(report.checks.database.status).toBe('ok');
    expect(report.checks.redis).toEqual({ status: 'skipped', reason: 'not configured' });
  });
});
