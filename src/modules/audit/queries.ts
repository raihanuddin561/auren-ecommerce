import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { eventSchemas } from '@/lib/events';
import { markProcessed, wasProcessed } from '@/lib/inbox';
import { inngest } from '@/lib/jobs/client';
import { logger } from '@/lib/logger';
import { ALERT_TITLES, type AlertRuleId } from './alerts';
import { scanAuditForAlerts } from './service';

/**
 * Background jobs of the audit module: the alert scan and the owner mail. They are registered in
 * src/app/api/inngest/route.ts next to the platform jobs in lib/jobs.
 */

/** Cron: looks for risky staff activity in the audit trail and raises security alerts. */
export const securityAlertScan = inngest.createFunction(
  {
    id: 'security-alert-scan',
    triggers: [{ cron: '*/5 * * * *' }],
    // one scan at a time (the database lock also guarantees it)
    concurrency: { limit: 1 },
  },
  async () => {
    const alerts = await scanAuditForAlerts(db);
    if (alerts.length > 0) logger.warn({ alerts: alerts.length }, 'security alerts raised');
    return { alerts: alerts.length };
  },
);

const alertEnvelope = z.object({
  outboxId: z.uuid(),
  payload: eventSchemas['security.alert'],
});

/**
 * Emails the owner(s) about a security alert. The message names the rule and the counts, plus the
 * audit entry id to look up; it carries no customer data. Each recipient is recorded as handled
 * after the mail was sent, so a retry never mails the same owner twice (a crash between sending
 * and recording can still repeat one mail, which is acceptable for an alert).
 */
export async function handleSecurityAlert(data: unknown) {
  const { outboxId, payload } = alertEnvelope.parse(data);
  const owners = await db.staffMember.findMany({
    where: { role: 'owner', active: true },
    select: { id: true, user: { select: { email: true } } },
  });
  const title = ALERT_TITLES[payload.rule as AlertRuleId] ?? 'Security alert';
  const lines = [
    title,
    payload.count
      ? `Count: ${payload.count}${payload.windowMinutes ? ` in ${payload.windowMinutes} minutes` : ''}`
      : null,
    payload.actorId ? `Staff account id: ${payload.actorId}` : null,
    payload.auditLogId ? `Audit entry id: ${payload.auditLogId}` : null,
    `Alert id: ${outboxId}`,
    `Review it in the admin console: ${env.APP_URL}/admin`,
  ].filter((line): line is string => line !== null);

  let notified = 0;
  for (const owner of owners) {
    const consumer = `security.alert.mailer:${owner.id}`;
    if (await wasProcessed(db, consumer, outboxId)) continue;
    await sendEmail({
      to: owner.user.email,
      subject: `[AUREN security] ${title}`,
      text: lines.join('\n'),
      html: `<p>${lines.map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</p>`,
    });
    await markProcessed(db, consumer, outboxId);
    notified += 1;
  }
  return { notified };
}

export const securityAlertMailer = inngest.createFunction(
  { id: 'security-alert-mailer', triggers: [{ event: 'security.alert' }], retries: 4 },
  async ({ event }) => handleSecurityAlert(event.data),
);

export const auditFunctions = [securityAlertScan, securityAlertMailer];
