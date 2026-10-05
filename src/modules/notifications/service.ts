import { db, type Tx } from '@/lib/db';
import * as repo from './repository';

/** The send log: one row per message the system tried to send, with the recipient masked. */

export interface SendRecord {
  channel: 'email' | 'sms';
  template: string;
  toMasked: string;
  status: 'sent' | 'failed' | 'skipped';
  error?: string | null;
  relatedType?: string;
  relatedId?: string;
}

export async function recordSend(record: SendRecord, tx: Tx = db): Promise<void> {
  await repo.insertLog(tx, record);
}

/** True when this template was already sent for the entity (so a retried job does not send twice). */
export async function wasSent(
  template: string,
  relatedType: string,
  relatedId: string,
  tx: Tx = db,
): Promise<boolean> {
  return (await repo.countSent(tx, template, relatedType, relatedId)) > 0;
}
