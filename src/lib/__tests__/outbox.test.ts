import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import type { Tx } from '../db';
import { eventSchemas } from '../events';
import { outboxEventEnvelope } from '../jobs/client';
import { handleSampleEvent } from '../jobs/functions';
import {
  MAX_DISPATCH_ATTEMPTS,
  dispatchPendingEvents,
  enqueueEvent,
  retryDelayMs,
  type LeasedEvent,
} from '../outbox';
import { db } from '../db';

/** Tagged-template stub that records the interpolated values of each call. */
function sqlRecorder<T>(result: T) {
  const calls: unknown[][] = [];
  const fn = vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push(values);
    return result;
  });
  return { fn, calls };
}

const leasedRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: '0199aaaa-0000-7000-8000-000000000001',
  type: 'system.sample',
  aggregate_type: 'system',
  aggregate_id: 'x1',
  payload: { message: 'hello' },
  attempts: 1,
  created_at: new Date('2026-10-01T10:00:00Z'),
  ...over,
});

function fakeClient(rows: unknown[]) {
  const query = sqlRecorder(rows);
  const exec = sqlRecorder(1);
  const client = { $queryRaw: query.fn, $executeRaw: exec.fn } as unknown as PrismaClient;
  return { client, query, exec };
}

describe('event registry', () => {
  it('accepts a valid sample payload and rejects an empty message', () => {
    expect(eventSchemas['system.sample'].safeParse({ message: 'hi' }).success).toBe(true);
    expect(eventSchemas['system.sample'].safeParse({ message: '' }).success).toBe(false);
  });
});

describe('enqueueEvent', () => {
  it('writes the validated event through the caller transaction', async () => {
    const create = vi.fn(async () => ({ id: 'evt-1' }));
    const tx = { outboxEvent: { create } } as unknown as Tx;
    const id = await enqueueEvent(tx, {
      type: 'system.sample',
      aggregateType: 'system',
      aggregateId: 's1',
      payload: { message: 'hello' },
    });
    expect(id).toBe('evt-1');
    expect(create).toHaveBeenCalledWith({
      data: {
        type: 'system.sample',
        aggregateType: 'system',
        aggregateId: 's1',
        payload: { message: 'hello' },
      },
      select: { id: true },
    });
  });

  it('refuses a payload that breaks the event contract, writing nothing', async () => {
    const create = vi.fn();
    const tx = { outboxEvent: { create } } as unknown as Tx;
    await expect(
      enqueueEvent(tx, {
        type: 'system.sample',
        aggregateType: 'system',
        aggregateId: 's1',
        payload: { message: '' },
      }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('retry backoff', () => {
  it('doubles from 5 seconds and caps at 15 minutes', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([5_000, 10_000, 20_000, 40_000]);
    expect(retryDelayMs(0)).toBe(5_000);
    expect(retryDelayMs(20)).toBe(15 * 60_000);
  });
});

describe('dispatchPendingEvents', () => {
  it('does nothing when no event is due', async () => {
    const { client, exec } = fakeClient([]);
    const send = vi.fn();
    expect(await dispatchPendingEvents(client, send)).toEqual({
      leased: 0,
      dispatched: 0,
      failed: 0,
    });
    expect(send).not.toHaveBeenCalled();
    expect(exec.fn).toHaveBeenCalledTimes(1); // only the exhausted-attempts cleanup
  });

  it('sends leased events outside any transaction and marks them dispatched', async () => {
    const { client, exec } = fakeClient([leasedRow()]);
    const send = vi.fn(async (_events: LeasedEvent[]) => undefined);
    const summary = await dispatchPendingEvents(client, send);
    expect(summary).toEqual({ leased: 1, dispatched: 1, failed: 0 });
    expect(send.mock.calls[0]?.[0]).toMatchObject([
      { id: '0199aaaa-0000-7000-8000-000000000001', type: 'system.sample', attempts: 1 },
    ]);
    expect(exec.calls.at(-1)).toEqual([['0199aaaa-0000-7000-8000-000000000001']]);
  });

  it('keeps the error and leaves the backoff in place when sending fails', async () => {
    const { client, exec } = fakeClient([leasedRow({ attempts: 3 })]);
    const send = vi.fn(async () => {
      throw new Error('inngest unreachable');
    });
    const summary = await dispatchPendingEvents(client, send);
    expect(summary).toEqual({ leased: 1, dispatched: 0, failed: 0 });
    expect(exec.calls.at(-1)).toEqual([
      'pending',
      'inngest unreachable',
      '0199aaaa-0000-7000-8000-000000000001',
    ]);
  });

  it('marks an event failed after the final attempt instead of retrying forever', async () => {
    const { client, exec } = fakeClient([leasedRow({ attempts: MAX_DISPATCH_ATTEMPTS })]);
    const summary = await dispatchPendingEvents(client, async () => {
      throw new Error('still down');
    });
    expect(summary.failed).toBe(1);
    expect(exec.calls.at(-1)?.[0]).toBe('failed');
  });

  it('isolates a poison event: neighbours are delivered, only the bad one burns attempts', async () => {
    const good = leasedRow({ id: '0199aaaa-0000-7000-8000-00000000000a' });
    const bad = leasedRow({ id: '0199aaaa-0000-7000-8000-00000000000b', payload: { huge: true } });
    const { client, exec } = fakeClient([good, bad]);
    const send = vi.fn(async (events: LeasedEvent[]) => {
      if (events.some((e) => e.id.endsWith('0b'))) throw new Error('event too large');
    });
    const summary = await dispatchPendingEvents(client, send);
    expect(summary).toEqual({ leased: 2, dispatched: 1, failed: 0 });
    expect(send).toHaveBeenCalledTimes(3); // the batch, then each event alone
    const [markDispatched, rescheduleBad] = exec.calls.slice(1);
    expect(markDispatched).toEqual([['0199aaaa-0000-7000-8000-00000000000a']]);
    expect(rescheduleBad).toEqual([
      'pending',
      'event too large',
      '0199aaaa-0000-7000-8000-00000000000b',
    ]);
  });

  it('guards status transitions and never deletes events', async () => {
    const { client, query, exec } = fakeClient([leasedRow()]);
    await dispatchPendingEvents(client, async () => undefined);
    const sql = [...query.fn.mock.calls, ...exec.fn.mock.calls]
      .map(([strings]) => strings.join('?'))
      .join(' ');
    expect(sql).not.toMatch(/DELETE/i);
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(sql).toMatch(/AND status = 'pending'/);
  });
});

describe('Inngest envelope', () => {
  it('uses the outbox id as the event id so duplicate sends collapse', () => {
    const envelope = outboxEventEnvelope({
      id: 'o1',
      type: 'system.sample',
      aggregateType: 'system',
      aggregateId: 's1',
      payload: { message: 'hello' },
      createdAt: new Date('2026-10-01T10:00:00Z'),
    });
    expect(envelope).toEqual({
      id: 'o1',
      name: 'system.sample',
      data: {
        outboxId: 'o1',
        aggregateType: 'system',
        aggregateId: 's1',
        occurredAt: '2026-10-01T10:00:00.000Z',
        payload: { message: 'hello' },
      },
    });
  });
});

describe('sample handler idempotency', () => {
  const outboxId = '0199aaaa-0000-7000-8000-000000000001';
  const data = { outboxId, payload: { message: 'hello' } };

  /** A transaction stub whose claim table behaves like the processed_events primary key. */
  function stubTransactions() {
    const claimed = new Set<string>();
    const create = vi.fn(async () => ({}));
    const run = async (callback: (tx: Tx) => Promise<unknown>) => {
      const pending = new Set<string>();
      const tx = {
        storeSetting: { create },
        $executeRaw: async (_s: TemplateStringsArray, consumer: string, eventId: string) => {
          const key = `${consumer}:${eventId}`;
          if (claimed.has(key) || pending.has(key)) return 0;
          pending.add(key);
          return 1;
        },
      } as unknown as Tx;
      const result = await callback(tx); // a throw here discards `pending`: the claim rolls back
      pending.forEach((key) => claimed.add(key));
      return result;
    };
    vi.spyOn(db, '$transaction').mockImplementation(run as never);
    return { create };
  }

  it('applies the effect once however many times the event is delivered', async () => {
    const { create } = stubTransactions();
    expect(await handleSampleEvent(data)).toMatchObject({ executed: true });
    expect(await handleSampleEvent(data)).toEqual({ executed: false });
    expect(await handleSampleEvent(data)).toEqual({ executed: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('lets a retry succeed after the first attempt fails (the claim rolls back)', async () => {
    const { create } = stubTransactions();
    create.mockRejectedValueOnce(new Error('database blip'));
    await expect(handleSampleEvent(data)).rejects.toThrow('database blip');
    expect(await handleSampleEvent(data)).toMatchObject({ executed: true });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('rejects an envelope that does not match the contract', async () => {
    stubTransactions();
    await expect(handleSampleEvent({ outboxId: 'nope', payload: {} })).rejects.toThrow();
  });
});
