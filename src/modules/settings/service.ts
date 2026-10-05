import type { z } from 'zod';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { fromDecimalString } from '@/lib/money';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';
import {
  checkoutProtectionSchema,
  codSettingsSchema,
  DEFAULT_CHECKOUT_PROTECTION,
  DEFAULT_COD_SETTINGS,
  SETTING_KEYS,
  type CheckoutProtection,
  type CodSettings,
  type SaveCheckoutSettingsInput,
} from './schemas';

/** Stored value merged over the defaults; an unreadable stored value falls back to the defaults. */
function parseSetting<S extends z.ZodType>(schema: S, stored: unknown, fallback: z.infer<S>) {
  if (stored === null || typeof stored !== 'object') return fallback;
  const parsed = schema.safeParse({ ...(fallback as object), ...(stored as object) });
  return parsed.success ? (parsed.data as z.infer<S>) : fallback;
}

export async function getCheckoutProtection(tx: Tx = db): Promise<CheckoutProtection> {
  return parseSetting(
    checkoutProtectionSchema,
    await repo.readSetting(tx, SETTING_KEYS.checkout),
    DEFAULT_CHECKOUT_PROTECTION,
  );
}

export async function getCodSettings(tx: Tx = db): Promise<CodSettings> {
  return parseSetting(
    codSettingsSchema,
    await repo.readSetting(tx, SETTING_KEYS.cod),
    DEFAULT_COD_SETTINGS,
  );
}

export interface SettingsActor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** Saves the checkout protection and cash on delivery settings together. Audited. */
export async function saveCheckoutSettings(
  input: SaveCheckoutSettingsInput,
  actor: SettingsActor,
): Promise<void> {
  let maxOrder;
  try {
    maxOrder = fromDecimalString(input.codMaxOrder, 'BDT');
    if (maxOrder.minor <= 0n) throw new Error('not positive');
  } catch {
    throw new DomainError('VALIDATION', 'Enter the largest cash on delivery order in taka.', {
      fieldErrors: { codMaxOrder: ['Enter an amount above zero, for example 50,000.'] },
    });
  }
  const protection: CheckoutProtection = {
    otpRequired: input.otpRequired,
    maxOpenOrdersPerPhone: input.maxOpenOrdersPerPhone,
    maxOrdersPerPhonePerDay: input.maxOrdersPerPhonePerDay,
    maxOpenOrdersPerAddress: input.maxOpenOrdersPerAddress,
    maxOrdersPerIpPerDay: input.maxOrdersPerIpPerDay,
    maxUnitsPerVariantPerPhone: input.maxUnitsPerVariantPerPhone,
  };
  const cod: CodSettings = { enabled: input.codEnabled, maxOrderMinor: maxOrder.minor.toString() };
  await db.$transaction(async (tx) => {
    const beforeProtection = await getCheckoutProtection(tx);
    const beforeCod = await getCodSettings(tx);
    await repo.writeSetting(tx, SETTING_KEYS.checkout, protection, actor.userId);
    await repo.writeSetting(tx, SETTING_KEYS.cod, cod, actor.userId);
    await audit(tx, {
      actorId: actor.userId,
      action: 'setting.update',
      entity: 'setting',
      entityId: 'checkout',
      before: { ...beforeProtection, cod: beforeCod },
      after: { ...protection, cod },
      ...(actor.ip ? { ip: actor.ip } : {}),
      ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
    });
  });
}
