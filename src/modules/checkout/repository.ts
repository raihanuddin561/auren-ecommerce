import type { Tx } from '@/lib/db';

/** Phone codes live in the `verifications` table (identifier, hashed value, expiry). */

export async function replaceVerification(
  tx: Tx,
  identifier: string,
  value: string,
  expiresAt: Date,
): Promise<void> {
  await tx.verification.deleteMany({ where: { identifier } });
  await tx.verification.create({ data: { identifier, value, expiresAt } });
}

export const findVerification = (tx: Tx, identifier: string) =>
  tx.verification.findFirst({ where: { identifier }, orderBy: { createdAt: 'desc' } });

export const deleteVerifications = (tx: Tx, identifier: string) =>
  tx.verification.deleteMany({ where: { identifier } });
