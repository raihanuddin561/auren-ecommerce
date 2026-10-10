import { z } from 'zod';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { fromDecimalString } from '@/lib/money';
import { getMediaProvider, newMediaKey, processImage, validateUpload } from '@/lib/media';
import { MAX_IMAGE_BYTES } from '@/lib/media/upload';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';
import {
  checkoutProtectionSchema,
  codSettingsSchema,
  DEFAULT_CHECKOUT_PROTECTION,
  DEFAULT_COD_SETTINGS,
  DEFAULT_HERO_CAROUSEL_SETTINGS,
  DEFAULT_NAVIGATION_SETTINGS,
  DEFAULT_RETURN_SETTINGS,
  DEFAULT_STORE_GENERAL_SETTINGS,
  DEFAULT_VERIFICATION_SETTINGS,
  heroCarouselSettingsSchema,
  navigationSettingsSchema,
  returnSettingsSchema,
  storeGeneralSettingsSchema,
  verificationSettingsSchema,
  type NavigationSettings,
  type ReturnSettings,
  type StoreGeneralSettings,
  type VerificationSettings,
  SETTING_KEYS,
  type CheckoutProtection,
  type CodSettings,
  type HeroCarouselSettings,
  type SaveCheckoutSettingsInput,
  type SaveHeroCarouselSettingsInput,
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

export async function getVerificationSettings(tx: Tx = db): Promise<VerificationSettings> {
  return parseSetting(
    verificationSettingsSchema,
    await repo.readSetting(tx, SETTING_KEYS.verification),
    DEFAULT_VERIFICATION_SETTINGS,
  );
}

export async function getReturnSettings(tx: Tx = db): Promise<ReturnSettings> {
  return parseSetting(
    returnSettingsSchema,
    await repo.readSetting(tx, SETTING_KEYS.returns),
    DEFAULT_RETURN_SETTINGS,
  );
}

export async function getStoreGeneralSettings(tx: Tx = db): Promise<StoreGeneralSettings> {
  return parseSetting(
    storeGeneralSettingsSchema,
    await repo.readSetting(tx, SETTING_KEYS.general),
    DEFAULT_STORE_GENERAL_SETTINGS,
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

/**
 * Returns the hero carousel settings. Falls back to DEFAULT_HERO_CAROUSEL_SETTINGS
 * if unconfigured or empty.
 */
export async function getHeroCarouselSettings(tx: Tx = db): Promise<HeroCarouselSettings> {
  const raw = await repo.readSetting(tx, SETTING_KEYS.heroCarousel);
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_HERO_CAROUSEL_SETTINGS;
  }
  const parsed = heroCarouselSettingsSchema.safeParse(raw);
  if (!parsed.success || parsed.data.slides.length === 0) {
    return DEFAULT_HERO_CAROUSEL_SETTINGS;
  }
  return parsed.data;
}

/** Saves storefront hero carousel settings with audit logging. */
export async function saveHeroCarouselSettings(
  input: SaveHeroCarouselSettingsInput,
  actor: SettingsActor,
): Promise<void> {
  const parsed = heroCarouselSettingsSchema.parse(input);
  const sortedSlides = [...parsed.slides].sort((a, b) => a.sortOrder - b.sortOrder);
  const data: HeroCarouselSettings = {
    ...parsed,
    slides: sortedSlides,
  };

  await db.$transaction(async (tx) => {
    const before = await getHeroCarouselSettings(tx);
    await repo.writeSetting(tx, SETTING_KEYS.heroCarousel, data, actor.userId);
    await audit(tx, {
      actorId: actor.userId,
      action: 'setting.update',
      entity: 'setting',
      entityId: 'hero_carousel',
      before,
      after: data,
      ...(actor.ip ? { ip: actor.ip } : {}),
      ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
    });
  });
}

/** Uploads an image file to the media provider specifically for carousel/banner campaigns. */
export async function uploadHeroSlideImage(bytes: Buffer): Promise<{ url: string }> {
  const check = validateUpload(bytes, { kind: 'image', maxBytes: MAX_IMAGE_BYTES });
  if (!check.ok) {
    throw new DomainError('VALIDATION', check.message, {
      fieldErrors: { file: [check.message] },
    });
  }
  let processed;
  try {
    processed = await processImage(bytes);
  } catch {
    throw new DomainError('VALIDATION', 'That image could not be read. Try another file.', {
      fieldErrors: { file: ['That image could not be read. Try another file.'] },
    });
  }
  const provider = getMediaProvider();
  const stored = await provider.put({
    key: newMediaKey('carousel', processed.extension),
    body: processed.body,
    contentType: processed.mime,
  });
  return { url: stored.url };
}

// ---------------------------------------------------------------------------------------------
// Saved list views (per staff member)
// ---------------------------------------------------------------------------------------------

export interface SavedView {
  name: string;
  /** The query string of the list page, without the leading question mark. */
  query: string;
}

const MAX_SAVED_VIEWS = 12;

const savedViewsSchema = z.array(
  z.object({ name: z.string().min(1).max(40), query: z.string().max(400) }).strict(),
);

const viewsKey = (list: string, userId: string) => `views.${list}.${userId}`;

export async function getSavedViews(
  list: string,
  userId: string,
  tx: Tx = db,
): Promise<SavedView[]> {
  const parsed = savedViewsSchema.safeParse(await repo.readSetting(tx, viewsKey(list, userId)));
  return parsed.success ? parsed.data : [];
}

/** Adds or replaces a view with the same name. A staff member keeps at most a dozen. */
export async function saveView(
  list: string,
  userId: string,
  view: SavedView,
): Promise<SavedView[]> {
  return db.$transaction(async (tx) => {
    const current = await getSavedViews(list, userId, tx);
    const next = [...current.filter((item) => item.name !== view.name), view];
    if (next.length > MAX_SAVED_VIEWS) {
      throw new DomainError('VALIDATION', `You can keep up to ${MAX_SAVED_VIEWS} saved views.`, {
        fieldErrors: { name: ['Delete a view before saving another.'] },
      });
    }
    await repo.writeSetting(
      tx,
      viewsKey(list, userId),
      next.map((v) => ({ name: v.name, query: v.query })),
      userId,
    );
    return next;
  });
}

export async function deleteView(list: string, userId: string, name: string): Promise<SavedView[]> {
  return db.$transaction(async (tx) => {
    const next = (await getSavedViews(list, userId, tx)).filter((item) => item.name !== name);
    await repo.writeSetting(
      tx,
      viewsKey(list, userId),
      next.map((v) => ({ name: v.name, query: v.query })),
      userId,
    );
    return next;
  });
}

// ---------------------------------------------------------------------------------------------
// Verification and returns
// ---------------------------------------------------------------------------------------------

/** Saves verification rules and the return window together. Audited. */
export async function saveOrderRules(
  input: { verification: VerificationSettings; returns: ReturnSettings },
  actor: SettingsActor,
): Promise<void> {
  const verification = verificationSettingsSchema.parse(input.verification);
  const returns = returnSettingsSchema.parse(input.returns);
  await db.$transaction(async (tx) => {
    const before = {
      verification: await getVerificationSettings(tx),
      returns: await getReturnSettings(tx),
    };
    await repo.writeSetting(tx, SETTING_KEYS.verification, verification, actor.userId);
    await repo.writeSetting(tx, SETTING_KEYS.returns, returns, actor.userId);
    await audit(tx, {
      actorId: actor.userId,
      action: 'setting.update',
      entity: 'setting',
      entityId: 'order_rules',
      before,
      after: { verification, returns },
      ...(actor.ip ? { ip: actor.ip } : {}),
      ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
    });
  });
}

/** Saves general store settings. Audited. */
export async function saveStoreGeneralSettings(
  input: StoreGeneralSettings,
  actor: SettingsActor,
): Promise<StoreGeneralSettings> {
  const validated = storeGeneralSettingsSchema.parse(input);
  await db.$transaction(async (tx) => {
    const before = await getStoreGeneralSettings(tx);
    await repo.writeSetting(tx, SETTING_KEYS.general, validated, actor.userId);
    await audit(tx, {
      actorId: actor.userId,
      action: 'setting.update',
      entity: 'setting',
      entityId: 'store_general',
      before,
      after: validated,
      ...(actor.ip ? { ip: actor.ip } : {}),
      ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
    });
  });
  return validated;
}

// ---------------------------------------------------------------------------------------------
// Navigation & Mega Menu Management
// ---------------------------------------------------------------------------------------------

/**
 * Loads storefront navigation items, falling back to the default luxury menswear menu
 * if not yet saved or if unparseable.
 */
export async function getNavigationSettings(tx: Tx = db): Promise<NavigationSettings> {
  const raw = await repo.readSetting(tx, SETTING_KEYS.navigation);
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_NAVIGATION_SETTINGS;
  }
  const parsed = navigationSettingsSchema.safeParse(raw);
  if (!parsed.success || parsed.data.items.length === 0) {
    return DEFAULT_NAVIGATION_SETTINGS;
  }
  return parsed.data;
}

/** Saves storefront navigation settings with audit logging. */
export async function saveNavigationSettings(
  input: NavigationSettings,
  actor: SettingsActor,
): Promise<NavigationSettings> {
  const parsed = navigationSettingsSchema.parse(input);
  await db.$transaction(async (tx) => {
    const before = await getNavigationSettings(tx);
    await repo.writeSetting(tx, SETTING_KEYS.navigation, parsed, actor.userId);
    await audit(tx, {
      actorId: actor.userId,
      action: 'setting.update',
      entity: 'setting',
      entityId: 'navigation',
      before,
      after: parsed,
      ...(actor.ip ? { ip: actor.ip } : {}),
      ...(actor.userAgent ? { userAgent: actor.userAgent } : {}),
    });
  });
  return parsed;
}

/** Resets navigation back to default luxury menu. Audited. */
export async function resetNavigationSettings(actor: SettingsActor): Promise<NavigationSettings> {
  return saveNavigationSettings(DEFAULT_NAVIGATION_SETTINGS, actor);
}
