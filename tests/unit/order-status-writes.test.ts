import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cancelOrderSchema, confirmOrderSchema, holdOrderSchema } from '@/modules/orders/schemas';

/**
 * INV-O1 and INV-O2 as a test of the source: only a staff action can confirm or cancel an order.
 * No job, webhook, handler or cron path may write those statuses, and there is no bulk confirm.
 */

const SRC = join(process.cwd(), 'src');

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'generated') continue;
      yield* sourceFiles(path);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      yield path;
    }
  }
}

const rel = (path: string) => relative(SRC, path).split(sep).join('/');
const files = [...sourceFiles(SRC)].map((path) => ({
  path: rel(path),
  text: readFileSync(path, 'utf8'),
}));

const grep = (pattern: RegExp) =>
  files.filter((file) => pattern.test(file.text)).map((file) => file.path);

describe('who can write order statuses (INV-O1, INV-O2)', () => {
  it('only the verification service moves an order to confirmed or cancelled', () => {
    expect(grep(/to:\s*'(confirmed|cancelled)'/)).toEqual(['modules/orders/verification.ts']);
  });

  it('only the verification service sets confirmed_by, confirmed_at, cancelled_by or cancelled_at', () => {
    // The others mention the names without writing them: the event schema and the admin read models.
    expect(grep(/\b(confirmedBy|confirmedAt|cancelledBy|cancelledAt)\s*:/)).toEqual([
      'lib/events.ts',
      'modules/orders/admin-types.ts',
      'modules/orders/detail.ts',
      'modules/orders/verification.ts',
    ]);
  });

  it('every status write goes through transitionOrder, which only the orders module calls', () => {
    const callers = grep(/\btransitionOrder\(/);
    for (const path of callers) expect(path.startsWith('modules/orders/'), path).toBe(true);
    // The compare-and-set write itself is private to the orders module.
    for (const path of grep(/\.setStatus\(/)) {
      expect(path.startsWith('modules/orders/'), path).toBe(true);
    }
  });

  it('nothing writes orders.status with raw SQL or a direct update outside the orders module', () => {
    const offenders = files.filter(
      (file) =>
        !file.path.startsWith('modules/orders/') &&
        (/UPDATE\s+"?orders"?\s+SET[^;]*\bstatus\b/is.test(file.text) ||
          /\border\.(update|updateMany)\(\{[^}]*\bstatus\s*:/s.test(file.text)),
    );
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it('jobs, webhooks, route handlers and event handlers never call the verification service', () => {
    const verification =
      /@\/modules\/orders\/verification|from '\.\/verification'|from '\.\.\/verification'/;
    const importers = grep(verification);
    // The orders actions (staff only) and the edit service (which asserts the claim) are the only importers.
    expect(importers.sort()).toEqual(['modules/orders/actions.ts', 'modules/orders/edit.ts']);
    for (const file of files) {
      const isBackground =
        file.path.startsWith('lib/jobs/') ||
        file.path.startsWith('app/api/') ||
        /inngest\.createFunction/.test(file.text);
      if (!isBackground) continue;
      expect(
        /confirmOrder|cancelOrder|holdOrder|confirmOrderAction|cancelOrderAction/.test(file.text),
        `${file.path} must not confirm or cancel orders`,
      ).toBe(false);
    }
  });

  it('there is no bulk confirm: every verification action takes exactly one order id', () => {
    const one = { orderId: '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e' };
    const many = { orderIds: [one.orderId, one.orderId] };
    const checklist = { genuine: true, items: true, address: true, payment: true, stock: true };
    expect(confirmOrderSchema.safeParse({ ...one, checklist }).success).toBe(true);
    expect(confirmOrderSchema.safeParse({ ...many, checklist }).success).toBe(false);
    expect(confirmOrderSchema.safeParse({ orderId: many.orderIds, checklist }).success).toBe(false);
    // The checklist is part of the request and cannot be left out, so a bare "confirm" is refused.
    expect(confirmOrderSchema.safeParse(one).success).toBe(false);
    expect(holdOrderSchema.safeParse({ ...many }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({ ...many, reason: 'duplicate' }).success).toBe(false);
  });

  it('the verifying staff member can never come from the request', () => {
    const checklist = { genuine: true, items: true, address: true, payment: true, stock: true };
    const base = { orderId: '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e', checklist };
    for (const key of ['confirmedBy', 'staffId', 'verifierId', 'confirmedAt', 'status']) {
      expect(confirmOrderSchema.safeParse({ ...base, [key]: 'x' }).success, key).toBe(false);
    }
  });

  it('a cancel needs a reason, and "other" needs words', () => {
    const orderId = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e';
    expect(cancelOrderSchema.safeParse({ orderId }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({ orderId, reason: 'other' }).success).toBe(false);
    expect(
      cancelOrderSchema.safeParse({ orderId, reason: 'other', note: 'Duplicate of AUR-1' }).success,
    ).toBe(true);
    expect(cancelOrderSchema.safeParse({ orderId, reason: 'fake_order' }).success).toBe(true);
  });

  it('no inventory expiry or cleanup code mentions cancelling an order', () => {
    for (const file of files.filter((f) => f.path.startsWith('modules/inventory/'))) {
      expect(/cancelOrder|status:\s*'cancelled'/.test(file.text), file.path).toBe(false);
    }
  });
});
