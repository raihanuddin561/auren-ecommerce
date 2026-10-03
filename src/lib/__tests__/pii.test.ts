import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { eventSchemas } from '../events';
import { findPiiKeys, isPiiKey } from '../pii';

vi.mock('../db', () => ({ db: {} }));

describe('personal data keys', () => {
  it.each([
    'email',
    'customerEmail',
    'phone',
    'phoneNumber',
    'mobile',
    'fullName',
    'first_name',
    'lastName',
    'customerName',
    'recipient_name',
    'address',
    'shippingAddress',
    'addressLine1',
    'street',
    'ip',
    'ipAddress',
    'userAgent',
    'dob',
  ])('%s is personal', (key) => expect(isPiiKey(key)).toBe(true));

  it.each([
    'id',
    'orderId',
    'customerId',
    'sku',
    'templateName',
    // a bare "name" is a product, category or role label far more often than a person
    'name',
    'addressId',
    'shippingAddressId',
    'emailVerified',
    'phoneHash',
    'customerId',
    'settingKey',
    'status',
    'totalMinor',
    'currency',
    'message',
    'description',
    'zipper',
    'recipient',
    'shipping',
  ])('%s is not', (key) => expect(isPiiKey(key)).toBe(false));

  it('finds nested keys with their path', () => {
    expect(
      findPiiKeys({
        orderId: 'o1',
        customer: { id: 'c1', email: 'a@b.test' },
        lines: [{ phone: '1' }],
      }),
    ).toEqual(['customer.email', 'lines[0].phone']);
  });
});

describe('event payloads carry identifiers only (INV-A9)', () => {
  it('no registered event schema declares a personal data field', () => {
    for (const [type, schema] of Object.entries(eventSchemas)) {
      const shape = (schema as unknown as { shape: Record<string, unknown> }).shape;
      expect(Object.keys(shape).filter(isPiiKey), type).toEqual([]);
    }
  });

  it('enqueueEvent refuses a payload that smuggles personal data', async () => {
    const { enqueueEvent } = await import('../outbox');
    const create = vi.fn(async () => ({ id: 'e1' }));
    const tx = { outboxEvent: { create } } as never;
    // a schema that allows extra keys must still not get a person into the outbox
    const original = eventSchemas['system.sample'];
    (eventSchemas as Record<string, unknown>)['system.sample'] = {
      parse: () => ({ message: 'x', customerEmail: 'a@b.test' }),
    };
    try {
      await expect(
        enqueueEvent(tx, {
          type: 'system.sample',
          aggregateType: 'sample',
          aggregateId: 'x',
          payload: { message: 'x' },
        }),
      ).rejects.toThrow(/personal data \(customerEmail\)/);
      expect(create).not.toHaveBeenCalled();
    } finally {
      (eventSchemas as Record<string, unknown>)['system.sample'] = original;
    }
  });
});

describe('security contact', () => {
  const file = readFileSync(path.join(process.cwd(), 'public/.well-known/security.txt'), 'utf8');

  it('publishes a contact and a policy', () => {
    expect(file).toMatch(/^Contact: https:\/\//m);
    expect(file).toMatch(/^Policy: https:\/\//m);
    expect(readFileSync(path.join(process.cwd(), 'SECURITY.md'), 'utf8')).toContain(
      'security/advisories/new',
    );
  });

  it('has an Expires date that is still in the future (renew it when this fails)', () => {
    const expires = /^Expires: (.+)$/m.exec(file)?.[1];
    expect(expires).toBeTruthy();
    const date = new Date(expires!);
    expect(date.getTime()).toBeGreaterThan(Date.now());
    // RFC 9116: no more than a year ahead
    expect(date.getTime() - Date.now()).toBeLessThan(366 * 24 * 3600 * 1000);
  });
});
