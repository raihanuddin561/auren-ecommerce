import { renderOrderUpdateEmail } from '@/emails/order-updates';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { markProcessed, wasProcessed } from '@/lib/inbox';
import { money } from '@/lib/money';
import { maskEmail, maskPhone } from '@/lib/phone';
import { formatPriceText } from '@/lib/price-format';
import { SmsUnavailableError, sendSms } from '@/integrations/sms';
import { deriveTrackingToken } from '@/modules/orders/tracking';
import { formatEta } from '@/modules/shipping/quote';
import * as repo from './repository';
import { recordSend } from './service';
import {
  confirmedCopy,
  copyForStatus,
  refundCopy,
  returnCopy,
  updatedCopy,
  type MessageContext,
  type MessageCopy,
} from './templates';

/**
 * Sends the messages that follow an order (13.1 to 13.3). Everything here runs from an outbox
 * event inside a background job, never inside a database transaction (INV-E1). Each (message,
 * channel, event) is claimed once in `processed_events`, so a retried job does not send twice
 * (INV-E2); every attempt, including skips and failures, is written to the send log. A customer
 * without an email address gets the SMS only, and the SMS adapter refuses in production until a
 * gateway is configured (it is logged as skipped, never pretended).
 */

export type NotifyResult = {
  email: 'sent' | 'skipped' | 'failed';
  sms: 'sent' | 'skipped' | 'none';
};

const price = (minor: bigint, currency: string) => formatPriceText(money(minor, currency));

async function contextFor(orderId: string): Promise<{
  order: NonNullable<Awaited<ReturnType<typeof repo.orderForMessage>>>;
  context: MessageContext;
} | null> {
  const order = await repo.orderForMessage(db, orderId);
  if (!order) return null;
  const method = order.shippingMethod as { minDays?: number; maxDays?: number } | null;
  const parcel = order.shipments[0];
  const origin = env.APP_URL.replace(/\/$/, '');
  return {
    order,
    context: {
      firstName: order.customerName.split(' ')[0] || order.customerName,
      orderNumber: order.orderNumber,
      trackUrl: `${origin}/track/${deriveTrackingToken(order.id)}`,
      total: price(
        order.totalMinor - order.paidMinor > 0n
          ? order.totalMinor - order.paidMinor
          : order.totalMinor,
        order.currency,
      ),
      courierName: parcel ? (parcel.courierName ?? parcel.courier) : null,
      trackingNumber: parcel?.trackingNumber ?? null,
      eta:
        method?.minDays !== undefined && method.maxDays !== undefined
          ? formatEta(method.minDays, method.maxDays)
          : null,
    },
  };
}

/** Sends one rendered message by email and SMS, once per event. */
async function deliver(input: {
  outboxId: string;
  order: NonNullable<Awaited<ReturnType<typeof repo.orderForMessage>>>;
  copy: MessageCopy;
  context: MessageContext;
}): Promise<NotifyResult> {
  const { outboxId, order, copy, context } = input;
  const result: NotifyResult = { email: 'skipped', sms: 'none' };

  const emailConsumer = `notify.email:${copy.template}`;
  if (!(await wasProcessed(db, emailConsumer, outboxId))) {
    if (!order.email) {
      await recordSend({
        channel: 'email',
        template: copy.template,
        toMasked: 'no email given',
        status: 'skipped',
        relatedType: 'order',
        relatedId: order.id,
      });
      await markProcessed(db, emailConsumer, outboxId);
    } else {
      const rendered = await renderOrderUpdateEmail(
        {
          template: copy.template,
          firstName: context.firstName,
          orderNumber: context.orderNumber,
          trackUrl: context.trackUrl,
          headline: copy.email.headline,
          preview: copy.email.preview,
          paragraphs: copy.email.paragraphs,
          facts: copy.email.facts,
          buttonLabel: copy.email.buttonLabel,
        },
        copy.email.subject,
      );
      try {
        await sendEmail({ to: order.email, ...rendered });
      } catch (error) {
        await recordSend({
          channel: 'email',
          template: copy.template,
          toMasked: maskEmail(order.email),
          status: 'failed',
          error: error instanceof Error ? error.message : 'send failed',
          relatedType: 'order',
          relatedId: order.id,
        });
        logger.error({ err: error, orderId: order.id, template: copy.template }, 'email failed');
        // Re-thrown so the job retries; the log keeps each failed attempt.
        throw error;
      }
      await recordSend({
        channel: 'email',
        template: copy.template,
        toMasked: maskEmail(order.email),
        status: 'sent',
        relatedType: 'order',
        relatedId: order.id,
      });
      await markProcessed(db, emailConsumer, outboxId);
      result.email = 'sent';
    }
  }

  if (copy.sms) {
    const smsConsumer = `notify.sms:${copy.template}`;
    result.sms = 'skipped';
    if (!(await wasProcessed(db, smsConsumer, outboxId))) {
      try {
        await sendSms({
          to: order.phone,
          text: copy.sms,
          idempotencyKey: `${copy.template}:${outboxId}`,
        });
        await recordSend({
          channel: 'sms',
          template: copy.template,
          toMasked: maskPhone(order.phone),
          status: 'sent',
          relatedType: 'order',
          relatedId: order.id,
        });
        result.sms = 'sent';
      } catch (error) {
        if (!(error instanceof SmsUnavailableError)) {
          await recordSend({
            channel: 'sms',
            template: copy.template,
            toMasked: maskPhone(order.phone),
            status: 'failed',
            error: error instanceof Error ? error.message : 'send failed',
            relatedType: 'order',
            relatedId: order.id,
          });
          throw error;
        }
        // No gateway yet: logged as skipped, not retried forever.
        await recordSend({
          channel: 'sms',
          template: copy.template,
          toMasked: maskPhone(order.phone),
          status: 'skipped',
          error: 'No SMS gateway is configured',
          relatedType: 'order',
          relatedId: order.id,
        });
      }
      await markProcessed(db, smsConsumer, outboxId);
    }
  }
  return result;
}

/** An order moved: confirmed, shipped, delivered or cancelled each tell the customer. */
export async function notifyOrderStatus(outboxId: string, orderId: string, to: string) {
  const loaded = await contextFor(orderId);
  if (!loaded) return null;
  const copy = copyForStatus(to, loaded.context);
  if (!copy) return null;
  return deliver({ outboxId, order: loaded.order, copy, context: loaded.context });
}

/** Staff changed the order while verifying it: the customer sees the new total. */
export async function notifyOrderUpdated(outboxId: string, orderId: string, totalChanged: boolean) {
  const loaded = await contextFor(orderId);
  if (!loaded) return null;
  const totals = await repo.latestEditTotals(db, orderId);
  const currency = loaded.order.currency;
  const context: MessageContext = {
    ...loaded.context,
    total: totals ? price(totals.after, currency) : price(loaded.order.totalMinor, currency),
    ...(totalChanged && totals ? { previousTotal: price(totals.before, currency) } : {}),
  };
  return deliver({ outboxId, order: loaded.order, copy: updatedCopy(context), context });
}

const METHOD_LABEL: Record<string, string> = {
  original: 'Original payment method',
  store_credit: 'Store credit',
  manual_bkash: 'bKash',
};

export async function notifyRefund(outboxId: string, refundId: string) {
  const refund = await repo.refundForMessage(db, refundId);
  if (!refund) return null;
  const loaded = await contextFor(refund.orderId);
  if (!loaded) return null;
  const context: MessageContext = {
    ...loaded.context,
    refundAmount: price(refund.amountMinor, refund.currency),
    refundMethod: METHOD_LABEL[refund.method] ?? refund.method,
  };
  return deliver({ outboxId, order: loaded.order, copy: refundCopy(context), context });
}

export async function notifyReturn(outboxId: string, returnId: string, status: string) {
  const found = await repo.returnForMessage(db, returnId);
  if (!found) return null;
  const loaded = await contextFor(found.orderId);
  if (!loaded) return null;
  const context: MessageContext = {
    ...loaded.context,
    returnNumber: found.returnNumber,
    returnStatus: status,
  };
  const copy = returnCopy(context);
  if (!copy) return null;
  return deliver({ outboxId, order: loaded.order, copy, context });
}

/** "Order received" SMS (the email is sent by the orders module). */
export async function notifyOrderReceivedSms(outboxId: string, orderId: string) {
  const loaded = await contextFor(orderId);
  if (!loaded) return null;
  const copy: MessageCopy = {
    template: 'order_confirmed',
    email: confirmedCopy(loaded.context).email,
    sms: `AUREN: We have your order ${loaded.context.orderNumber}. Our team will call you shortly to confirm it. Track it: ${loaded.context.trackUrl}`,
  };
  // Only the SMS goes out here: the received email is the orders module's own.
  const consumer = 'notify.sms:order_received';
  if (await wasProcessed(db, consumer, outboxId))
    return { email: 'skipped', sms: 'skipped' } as NotifyResult;
  try {
    await sendSms({
      to: loaded.order.phone,
      text: copy.sms!,
      idempotencyKey: `order_received:${outboxId}`,
    });
    await recordSend({
      channel: 'sms',
      template: 'order_received',
      toMasked: maskPhone(loaded.order.phone),
      status: 'sent',
      relatedType: 'order',
      relatedId: orderId,
    });
  } catch (error) {
    if (!(error instanceof SmsUnavailableError)) {
      await recordSend({
        channel: 'sms',
        template: 'order_received',
        toMasked: maskPhone(loaded.order.phone),
        status: 'failed',
        error: error instanceof Error ? error.message : 'send failed',
        relatedType: 'order',
        relatedId: orderId,
      });
      throw error;
    }
    await recordSend({
      channel: 'sms',
      template: 'order_received',
      toMasked: maskPhone(loaded.order.phone),
      status: 'skipped',
      error: 'No SMS gateway is configured',
      relatedType: 'order',
      relatedId: orderId,
    });
  }
  await markProcessed(db, consumer, outboxId);
  return { email: 'skipped', sms: 'sent' } as NotifyResult;
}

/** Tells owners, admins and managers that an order needs a person (never cancels anything). */
export async function notifyEscalation(
  outboxId: string,
  orderId: string,
  reason: 'sla_overdue' | 'failed_attempts',
) {
  const order = await repo.orderForMessage(db, orderId);
  if (!order) return { notified: 0 };
  const recipients = await repo.managerRecipients(db);
  const why =
    reason === 'sla_overdue'
      ? 'has waited longer than the verification target'
      : 'could not be reached after several attempts';
  const lines = [
    `Order ${order.orderNumber} ${why}.`,
    'It stays in the verification queue; nothing is cancelled automatically.',
    `Open the queue: ${env.APP_URL.replace(/\/$/, '')}/admin/orders/verification?filter=${reason === 'sla_overdue' ? 'overdue' : 'needs_review'}`,
  ];
  let notified = 0;
  for (const recipient of recipients) {
    const consumer = `notify.escalation:${recipient.id}`;
    if (await wasProcessed(db, consumer, outboxId)) continue;
    await sendEmail({
      to: recipient.user.email,
      subject: `[AUREN] Order ${order.orderNumber} needs a manager`,
      text: lines.join('\n'),
      html: `<p>${lines.map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</p>`,
    });
    await recordSend({
      channel: 'email',
      template: 'order_escalated',
      toMasked: maskEmail(recipient.user.email),
      status: 'sent',
      relatedType: 'order',
      relatedId: orderId,
    });
    await markProcessed(db, consumer, outboxId);
    notified += 1;
  }
  return { notified };
}
