import type { Tx } from '@/lib/db';

export const insertLog = (
  tx: Tx,
  data: {
    channel: 'email' | 'sms';
    template: string;
    toMasked: string;
    status: 'sent' | 'failed' | 'skipped';
    providerRef?: string | null;
    error?: string | null;
    relatedType?: string | null;
    relatedId?: string | null;
  },
) =>
  tx.notificationLog.create({
    data: {
      channel: data.channel,
      template: data.template,
      toMasked: data.toMasked,
      status: data.status,
      providerRef: data.providerRef ?? null,
      error: data.error?.slice(0, 500) ?? null,
      relatedType: data.relatedType ?? null,
      relatedId: data.relatedId ?? null,
    },
  });

export const countSent = (tx: Tx, template: string, relatedType: string, relatedId: string) =>
  tx.notificationLog.count({ where: { template, relatedType, relatedId, status: 'sent' } });
