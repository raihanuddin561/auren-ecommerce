import type { Tx } from '@/lib/db';

export const insertPayment = (
  tx: Tx,
  data: {
    orderId: string;
    provider: string;
    method: string;
    amountMinor: bigint;
    currency: string;
    status: 'pending' | 'initiated';
    idempotencyKey: string;
  },
) => tx.payment.create({ data });
