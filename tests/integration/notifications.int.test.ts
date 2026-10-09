import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearLoggedSms, getLoggedSms } from '@/integrations/sms';
import { db } from '@/lib/db';
import { clearLoggedEmails, getLoggedEmails } from '@/lib/email';
import { handleOrderPlaced } from '@/modules/orders/queries';
import { editOrder } from '@/modules/orders/edit';
import { cancelOrder, confirmOrder } from '@/modules/orders/verification';
import {
  handleOrderEscalated,
  handleOrderPlacedSms,
  handleOrderStatusChanged,
  handleOrderUpdated,
  handleRefundProcessed,
  handleReturnStatusChanged,
} from '@/modules/notifications/queries';
import { processRefund } from '@/modules/payments/refunds';
import { approveReturn, requestReturn } from '@/modules/returns/service';
import { escalateOverdueOrders } from '@/modules/orders/escalation';
import { makeStaff } from '../factories';
import {
  deliveredOrder,
  fullChecklist,
  makeSellableVariant,
  placeTestOrder,
  seedDelivery,
  verifierOf,
} from './commerce-helpers';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  await seedDelivery();
  clearLoggedEmails();
  clearLoggedSms();
});
afterAll(closeDatabase);

const inTx = <T>(work: Parameters<typeof db.$transaction>[0]) =>
  db.$transaction(work as never) as Promise<T>;

/** The outbox rows of one type for an aggregate, shaped like the job runner delivers them. */
async function events(type: string, aggregateId?: string) {
  const rows = await db.outboxEvent.findMany({
    where: { type, ...(aggregateId ? { aggregateId } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({ outboxId: row.id, payload: row.payload }));
}

const subjects = () => getLoggedEmails().map((email) => email.subject);
const logOf = (template: string) =>
  db.notificationLog.findMany({ where: { template }, orderBy: { createdAt: 'asc' } });

describe('order messages (13.1 to 13.3)', () => {
  it('sends nothing while the order is placed or confirmed: only the job sends, after commit (INV-E1)', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant });
    const staff = await makeStaff({ role: 'order_verifier' });
    await inTx((tx) =>
      confirmOrder(tx, {
        orderId,
        checklist: fullChecklist,
        channel: 'call',
        verifier: verifierOf(staff.member),
      }),
    );
    expect(getLoggedEmails()).toHaveLength(0);
    expect(getLoggedSms()).toHaveLength(0);
    expect(await db.notificationLog.count()).toBe(0);
    expect(await db.outboxEvent.count({ where: { type: 'order.status_changed' } })).toBeGreaterThan(
      0,
    );
  });

  it('received: email and SMS go out once, even if the job runs again', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant });
    const [placed] = await events('order.placed', orderId);
    await handleOrderPlaced(placed);
    await handleOrderPlaced(placed);
    await handleOrderPlacedSms(placed);
    await handleOrderPlacedSms(placed);
    expect(getLoggedEmails()).toHaveLength(1);
    expect(getLoggedEmails()[0]?.text).toContain('personally confirm');
    expect(getLoggedSms()).toHaveLength(1);
    expect(getLoggedSms()[0]?.text).toMatch(/We have your order AUR-\d+/);
    expect((await logOf('order_received')).map((row) => [row.channel, row.status])).toEqual([
      ['email', 'sent'],
      ['sms', 'sent'],
    ]);
  });

  it('confirmed: a branded email and an SMS, with plain text and no personal data in the log', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant, email: 'ayaan@example.com' });
    const staff = await makeStaff({ role: 'order_verifier' });
    await inTx((tx) =>
      confirmOrder(tx, {
        orderId,
        checklist: fullChecklist,
        channel: 'call',
        verifier: verifierOf(staff.member),
      }),
    );
    const changes = await events('order.status_changed', orderId);
    for (const change of changes) {
      await handleOrderStatusChanged(change);
      await handleOrderStatusChanged(change);
    }
    expect(subjects()).toEqual([expect.stringMatching(/^Your order AUR-\d+ is confirmed$/)]);
    const email = getLoggedEmails()[0]!;
    expect(email.to).toBe('ayaan@example.com');
    expect(email.html).toContain('AUREN');
    expect(email.text).toContain('is confirmed');
    expect(email.text).toContain('/track/');
    expect(getLoggedSms()).toHaveLength(1);
    expect(getLoggedSms()[0]?.text).toContain('confirmed');
    const rows = await logOf('order_confirmed');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.toMasked).not.toContain('ayaan@example.com');
      expect(row.toMasked).not.toMatch(/01712|1712/);
      expect(row).toMatchObject({ status: 'sent', relatedType: 'order', relatedId: orderId });
    }
  });

  it('shipped carries the courier and tracking number; delivered sends an email only', async () => {
    const delivered = await deliveredOrder({ quantity: 1 });
    const changes = await events('order.status_changed', delivered.orderId);
    for (const change of changes) await handleOrderStatusChanged(change);
    const shipped = getLoggedEmails().find((email) => email.subject.includes('on its way'));
    expect(shipped?.text).toContain('Sundarban');
    expect(shipped?.text).toMatch(/SB-\d+/);
    expect(getLoggedEmails().some((email) => email.subject.includes('was delivered'))).toBe(true);
    // SMS for confirmed and shipped, none for delivered.
    expect(getLoggedSms().map((sms) => sms.text.split(':')[1]?.trim().slice(0, 12))).toHaveLength(
      2,
    );
    expect((await logOf('order_delivered')).map((row) => row.channel)).toEqual(['email']);
  });

  it('cancelled: the customer is told, without any internal reason', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant });
    const staff = await makeStaff({ role: 'order_verifier' });
    await inTx((tx) =>
      cancelOrder(tx, {
        orderId,
        reason: 'fake_order',
        note: 'Looks fake',
        verifier: verifierOf(staff.member),
      }),
    );
    for (const change of await events('order.status_changed', orderId)) {
      await handleOrderStatusChanged(change);
    }
    const mail = getLoggedEmails().find((email) => email.subject.includes('cancelled'));
    expect(mail).toBeDefined();
    expect(`${mail?.text}${mail?.html}`.toLowerCase()).not.toContain('fake');
    expect(getLoggedSms()[0]?.text).toContain('cancelled');
  });

  it('a customer without an email gets the SMS and a skipped row for the email', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant, email: null });
    const staff = await makeStaff({ role: 'order_verifier' });
    await inTx((tx) =>
      confirmOrder(tx, {
        orderId,
        checklist: fullChecklist,
        channel: 'call',
        verifier: verifierOf(staff.member),
      }),
    );
    for (const change of await events('order.status_changed', orderId)) {
      await handleOrderStatusChanged(change);
    }
    expect(getLoggedEmails()).toHaveLength(0);
    expect(getLoggedSms()).toHaveLength(1);
    expect((await logOf('order_confirmed')).map((row) => [row.channel, row.status])).toEqual([
      ['email', 'skipped'],
      ['sms', 'sent'],
    ]);
  });

  it('updated during verification: the new and the old total, SMS only when the total changed', async () => {
    const variant = await makeSellableVariant({ stock: 5, priceMinor: 250000n });
    const { orderId } = await placeTestOrder({ variant, quantity: 1 });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId } });
    const staff = await makeStaff({ role: 'order_verifier' });
    await inTx((tx) =>
      editOrder(tx, {
        orderId,
        lines: [{ itemId: item.id, variantId: variant.variantId, quantity: 2 }],
        verifier: verifierOf(staff.member),
      }),
    );
    const [updated] = await events('order.updated', orderId);
    await handleOrderUpdated(updated);
    const mail = getLoggedEmails()[0]!;
    expect(mail.subject).toContain('was updated');
    expect(mail.text).toMatch(/New total/);
    expect(mail.text).toMatch(/Previous total/);
    expect(getLoggedSms()).toHaveLength(1);
  });

  it('refund and return updates reach the customer', async () => {
    const delivered = await deliveredOrder({ quantity: 1, priceMinor: 200000n });
    const manager = await makeStaff({ role: 'manager' });
    await inTx((tx) =>
      processRefund(tx, {
        orderId: delivered.orderId,
        amount: '500',
        method: 'manual_bkash',
        reason: 'goodwill',
        idempotencyKey: 'note-refund-1',
        staff: { staffId: manager.member.id, userId: manager.member.userId },
      }),
    );
    const [refund] = await events('refund.processed', delivered.orderId);
    await handleRefundProcessed(refund);
    await handleRefundProcessed(refund);
    expect(getLoggedEmails().filter((mail) => mail.subject.startsWith('A refund'))).toHaveLength(1);

    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: delivered.orderId } });
    const { returnId } = await inTx<{ returnId: string }>((tx) =>
      requestReturn(tx, {
        orderId: delivered.orderId,
        type: 'return',
        items: [{ orderItemId: item.id, quantity: 1, reason: 'too_small' }],
      }),
    );
    await inTx((tx) =>
      approveReturn(tx, {
        returnId,
        staff: { staffId: manager.member.id, userId: manager.member.userId },
      }),
    );
    for (const change of await events('return.status_changed'))
      await handleReturnStatusChanged(change);
    const headlines = getLoggedEmails().map((mail) => mail.subject);
    expect(headlines.some((subject) => subject.includes('We have your return request'))).toBe(true);
    expect(headlines.some((subject) => subject.includes('Your return is approved'))).toBe(true);
  });

  it('an order that waits too long alerts managers once and is never cancelled', async () => {
    const variant = await makeSellableVariant({ stock: 5 });
    const { orderId } = await placeTestOrder({ variant });
    await makeStaff({ role: 'manager' });
    await db.order.update({
      where: { id: orderId },
      data: { placedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
    });
    expect(await escalateOverdueOrders()).toEqual({ escalated: 1 });
    expect(await escalateOverdueOrders()).toEqual({ escalated: 0 });
    const [escalation] = await events('order.escalated', orderId);
    await handleOrderEscalated(escalation);
    await handleOrderEscalated(escalation);
    const mails = getLoggedEmails().filter((mail) => mail.subject.includes('needs a manager'));
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain('nothing is cancelled automatically');
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('placed');
  });
});
