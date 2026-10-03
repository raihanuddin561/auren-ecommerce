import { describe, expect, it, vi } from 'vitest';
import type { Tx } from '@/lib/db';
import { audit } from '../service';
import { changedKeys, toSnapshot } from '../snapshot';

describe('toSnapshot', () => {
  it('keeps money exact by writing bigint as text, and dates as ISO strings', () => {
    expect(
      toSnapshot({
        totalMinor: 9_007_199_254_740_993n,
        placedAt: new Date('2026-10-01T10:00:00Z'),
        qty: 2,
        gift: false,
      }),
    ).toEqual({
      totalMinor: '9007199254740993',
      placedAt: '2026-10-01T10:00:00.000Z',
      qty: 2,
      gift: false,
    });
  });

  it('redacts secrets at any depth, whatever the casing', () => {
    const snapshot = toSnapshot({
      email: 'a@b.com',
      password: 'hunter2',
      nested: { apiKey: 'k', Authorization: 'Bearer x', list: [{ resetToken: 't', ok: 1 }] },
      cardNumber: '4111',
      backupCodes: ['1', '2'],
    });
    const text = JSON.stringify(snapshot);
    for (const secret of ['hunter2', '"k"', 'Bearer x', '"t"', '4111']) {
      expect(text).not.toContain(secret);
    }
    // personal data is redacted as well: the trail keeps ids and changed keys, not people
    expect(snapshot).toMatchObject({
      email: expect.stringMatching(/^\[personal:[0-9a-f]{8}\]$/),
      nested: { list: [{ ok: 1 }] },
    });
    expect(text).not.toContain('a@b.com');
  });

  it('still shows THAT a personal field changed, through its fingerprint', () => {
    const before = toSnapshot({ id: 'c-1', phone: '+8801712345678', email: 'a@b.test' });
    const after = toSnapshot({ id: 'c-1', phone: '+8801798765432', email: 'a@b.test' });
    expect(changedKeys(before, after)).toEqual(['phone']);
    expect(JSON.stringify([before, after])).not.toContain('8801712345678');
  });

  it('does not treat references and flags as personal data', () => {
    expect(
      toSnapshot({ addressId: 'a-1', emailVerified: true, phoneHash: 'abc', name: 'Oxford shirt' }),
    ).toEqual({ addressId: 'a-1', emailVerified: true, phoneHash: 'abc', name: 'Oxford shirt' });
  });

  it('keeps ids but never names, phones, addresses or IPs (INV-A9)', () => {
    const snapshot = toSnapshot({
      customerId: 'c-1',
      customerName: 'Rahim Uddin',
      phone: '+8801712345678',
      shippingAddress: { line1: '12 Road 5', city: 'Dhaka' },
      ipAddress: '203.0.113.5',
      sku: 'OX-SHIRT-M',
      templateName: 'order-confirmed',
    });
    const text = JSON.stringify(snapshot);
    for (const personal of ['Rahim', '8801712345678', 'Road 5', '203.0.113.5']) {
      expect(text).not.toContain(personal);
    }
    expect(snapshot).toMatchObject({
      customerId: 'c-1',
      sku: 'OX-SHIRT-M',
      templateName: 'order-confirmed',
    });
  });

  it('redacts by whole word, so ordinary fields are not mangled', () => {
    expect(
      toSnapshot({
        cardigan: 'wool',
        footprint: 'small',
        discardReason: 'x',
        passwordHash: 'h',
        reset_token: 't',
      }),
    ).toEqual({
      cardigan: 'wool',
      footprint: 'small',
      discardReason: 'x',
      passwordHash: '[redacted]',
      reset_token: '[redacted]',
    });
  });

  it('survives awkward input: undefined, functions, NaN, cycles, deep nesting', () => {
    const cyclic: Record<string, unknown> = { label: 'loop' };
    cyclic.self = cyclic;
    expect(toSnapshot({ a: undefined, fn: () => 1, n: Number.NaN, cyclic })).toEqual({
      n: 'NaN',
      cyclic: { label: 'loop', self: '[circular]' },
    });
    let deep: unknown = 'leaf';
    for (let i = 0; i < 12; i++) deep = { child: deep };
    expect(JSON.stringify(toSnapshot(deep))).toContain('[max depth]');
    expect(toSnapshot(new Date('invalid'))).toBeNull();
    expect(toSnapshot(undefined)).toBeNull();
  });

  it('cuts oversized values instead of bloating the trail', () => {
    const big = { blob: 'x'.repeat(100_000) };
    expect(toSnapshot(big)).toMatchObject({
      truncated: true,
      bytes: expect.any(Number),
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('honours toJSON on plain objects but never on money-shaped objects', () => {
    expect(toSnapshot({ at: { toJSON: () => 'custom' } })).toEqual({ at: 'custom' });
    expect(toSnapshot({ price: { minor: 5n, currency: 'BDT', toJSON: () => 'x' } })).toEqual({
      price: { minor: '5', currency: 'BDT' },
    });
  });
});

describe('changedKeys', () => {
  it('lists only the fields that differ', () => {
    const before = toSnapshot({ title: 'Oxford', price: 5n, tags: ['a'] });
    const after = toSnapshot({ title: 'Oxford', price: 6n, tags: ['a'], sku: 'X' });
    expect(changedKeys(before, after)).toEqual(['price', 'sku']);
  });

  it('handles creates, deletes and scalars', () => {
    expect(changedKeys(null, toSnapshot({ a: 1 }))).toEqual(['(value)']);
    expect(changedKeys(null, null)).toEqual([]);
  });
});

describe('audit', () => {
  const fakeTx = () => {
    const create = vi.fn(async () => ({ id: 'log-1' }));
    return { tx: { auditLog: { create } } as unknown as Tx, create };
  };

  it('records actor, action, entity and sanitised before/after in the caller transaction', async () => {
    const { tx, create } = fakeTx();
    const id = await audit(tx, {
      actorId: 'user-1',
      action: 'product.update',
      entity: 'product',
      entityId: 'p1',
      before: { title: 'Old', passwordHash: 'x' },
      after: { title: 'New', priceMinor: 129900n },
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
    });
    expect(id).toBe('log-1');
    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'product.update',
        entityType: 'product',
        entityId: 'p1',
        before: { title: 'Old', passwordHash: '[redacted]' },
        after: { title: 'New', priceMinor: '129900' },
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
      },
      select: { id: true },
    });
  });

  it('allows creates (no before), deletes (no after) and system actions (no actor)', async () => {
    const { tx, create } = fakeTx();
    await audit(tx, {
      actorId: null,
      action: 'setting.delete',
      entity: 'setting',
      entityId: 'k',
      before: { v: 1 },
    });
    const data = (create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.actorId).toBeNull();
    expect(data.after).toBeUndefined();
  });

  it('rejects malformed actions and missing entities without writing anything', async () => {
    const { tx, create } = fakeTx();
    const base = { actorId: 'u', entity: 'order', entityId: 'o1' };
    await expect(audit(tx, { ...base, action: 'Confirm Order' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(audit(tx, { ...base, action: 'confirm' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(audit(tx, { ...base, action: 'order.confirm', entityId: '' })).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it('caps the stored user agent', async () => {
    const { tx, create } = fakeTx();
    await audit(tx, {
      actorId: 'u',
      action: 'order.confirm',
      entity: 'order',
      entityId: 'o1',
      userAgent: 'a'.repeat(1000),
    });
    const data = (create.mock.calls[0] as unknown as [{ data: { userAgent: string } }])[0].data;
    expect(data.userAgent).toHaveLength(300);
  });
});
