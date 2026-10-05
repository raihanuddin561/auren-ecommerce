import 'server-only';
import { env, isProduction } from '@/lib/env';
import { logger } from '@/lib/logger';
import { maskPhone } from '@/lib/phone';

/**
 * SMS behind an adapter, so a gateway can be chosen later without touching checkout. Only the
 * `log` transport exists: it writes the message to the server log (development, tests). In
 * production there is no transport until a gateway is added, and sending is refused rather than
 * pretended, so a customer is never told a code was sent when it was not.
 */
export interface SmsMessage {
  /** E.164 number. */
  to: string;
  text: string;
  /** Lets a gateway ignore a duplicate send (for example an outbox id). */
  idempotencyKey?: string;
}

export interface SmsProvider {
  readonly id: string;
  send(message: SmsMessage): Promise<void>;
}

/** Messages "sent" by the log transport; kept in memory for local work and tests only. */
const sent: SmsMessage[] = [];
export const getLoggedSms = (): readonly SmsMessage[] => sent;
export const clearLoggedSms = (): void => {
  sent.length = 0;
};

const logProvider: SmsProvider = {
  id: 'log',
  async send(message) {
    sent.push(message);
    if (sent.length > 50) sent.shift();
    logger.info({ to: maskPhone(message.to), text: message.text }, 'sms (log only)');
  },
};

export class SmsUnavailableError extends Error {
  constructor() {
    super('No SMS gateway is configured');
    this.name = 'SmsUnavailableError';
  }
}

/** The configured transport, or null when none is available (production without a gateway). */
export function getSmsProvider(): SmsProvider | null {
  const choice = env.SMS_PROVIDER ?? (isProduction ? undefined : 'log');
  if (choice === 'log') return logProvider;
  return null;
}

export async function sendSms(message: SmsMessage): Promise<void> {
  const provider = getSmsProvider();
  if (!provider) throw new SmsUnavailableError();
  await provider.send(message);
}
