import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';

export async function readSetting(tx: Tx, key: string): Promise<unknown> {
  const row = await tx.storeSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export const writeSetting = (
  tx: Tx,
  key: string,
  value: Prisma.InputJsonValue,
  updatedBy: string | null,
) =>
  tx.storeSetting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
