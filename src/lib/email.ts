import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { env, isProduction } from './env';
import { logger } from './logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailTransport = 'resend' | 'smtp' | 'log';

export function pickTransport(config: {
  RESEND_API_KEY?: string | undefined;
  SMTP_URL?: string | undefined;
}): EmailTransport {
  if (config.RESEND_API_KEY) return 'resend';
  if (config.SMTP_URL) return 'smtp';
  return 'log';
}

/** Messages "sent" while no provider is configured. Kept in memory for local work and tests only. */
const logged: EmailMessage[] = [];
export const getLoggedEmails = (): readonly EmailMessage[] => logged;
export const clearLoggedEmails = (): void => {
  logged.length = 0;
};

let resend: Resend | undefined;
let smtp: Transporter | undefined;

/**
 * Sends one email. Never call this inside a database transaction (INV-E1); background mail goes
 * through the outbox. Authentication mail is the exception: Better Auth calls it outside any
 * transaction and a failed send is recoverable because the user can request it again.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const transport = pickTransport(env);

  if (transport === 'resend') {
    resend ??= new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
    if (error) throw new Error(`Resend rejected the email: ${error.message}`);
    return;
  }

  if (transport === 'smtp') {
    smtp ??= nodemailer.createTransport(env.SMTP_URL!);
    await smtp.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
    return;
  }

  if (isProduction) {
    logger.error({ subject: message.subject }, 'no email provider configured; message not sent');
    return;
  }
  logged.push(message);
  if (logged.length > 50) logged.shift();
  // Local development convenience: the body contains the verification or reset link.
  logger.info({ to: message.to, subject: message.subject, text: message.text }, 'email (log only)');
}

/** Fire-and-forget wrapper for callbacks that must not await delivery (timing side channels). */
export function sendEmailInBackground(message: EmailMessage): void {
  sendEmail(message).catch((error: unknown) => {
    logger.error({ err: error, subject: message.subject }, 'email delivery failed');
  });
}
