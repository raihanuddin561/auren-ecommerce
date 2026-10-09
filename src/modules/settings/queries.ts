import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { toDecimalString, money } from '@/lib/money';
import { HERO_CAROUSEL_CACHE_TAG, type HeroCarouselSettings } from './schemas';
import {
  getCheckoutProtection,
  getCodSettings,
  getHeroCarouselSettings,
  getReturnSettings,
  getSavedViews,
  getStoreGeneralSettings,
  getVerificationSettings,
} from './service';

export { getReturnSettings, getSavedViews, getStoreGeneralSettings, getVerificationSettings };
export async function getStoreGeneralSettingsForAdmin() {
  return getStoreGeneralSettings();
}

import type { CheckoutSettingsView, SystemHealthData } from './types';
export type { SystemHealthData };

/** Cash on delivery and checkout protection as the settings form shows them. */
export async function getCheckoutSettingsForAdmin(): Promise<CheckoutSettingsView> {
  const [protection, cod] = await Promise.all([getCheckoutProtection(), getCodSettings()]);
  return {
    ...protection,
    codEnabled: cod.enabled,
    codMaxOrder: toDecimalString(money(BigInt(cod.maxOrderMinor), 'BDT')),
  };
}

/**
 * Returns active slides for the storefront home page hero carousel. Cached and tagged.
 */
export async function getHeroCarouselForStorefront(): Promise<HeroCarouselSettings> {
  'use cache';
  cacheLife('hours');
  cacheTag(HERO_CAROUSEL_CACHE_TAG);
  const settings = await getHeroCarouselSettings();
  const activeSlides = settings.slides.filter((slide) => slide.active);
  return {
    ...settings,
    slides: activeSlides.length > 0 ? activeSlides : settings.slides,
  };
}

/** Returns the hero carousel settings for admin management (includes inactive slides). */
export async function getHeroCarouselForAdmin(): Promise<HeroCarouselSettings> {
  return getHeroCarouselSettings();
}

/**
 * Probes core database, outbox queue, idempotency inbox, and connected services (15.6).
 */
export async function getSystemHealthForAdmin(): Promise<SystemHealthData> {
  const start = Date.now();
  let dbConnected = false;
  let dbLatencyMs = 0;

  try {
    await db.$queryRaw`SELECT 1`;
    dbConnected = true;
    dbLatencyMs = Date.now() - start;
  } catch {
    dbConnected = false;
    dbLatencyMs = -1;
  }

  const [pending, dispatched, failed, oldestPending, processedCount] = await Promise.all([
    db.outboxEvent.count({ where: { status: 'pending' } }),
    db.outboxEvent.count({ where: { status: 'dispatched' } }),
    db.outboxEvent.count({ where: { status: 'failed' } }),
    db.outboxEvent.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    db.processedEvent.count(),
  ]);

  const oldestPendingAgeMinutes = oldestPending
    ? Math.max(0, Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 60000))
    : null;

  const emailProvider = env.RESEND_API_KEY ? 'Resend' : env.SMTP_URL ? 'SMTP' : 'Log / Local';
  const emailConfigured = Boolean(env.RESEND_API_KEY || env.SMTP_URL);
  const storageProvider = env.BLOB_READ_WRITE_TOKEN ? 'Vercel Blob' : 'Local Storage';
  const inngestConfigured = Boolean(env.INNGEST_EVENT_KEY && env.INNGEST_SIGNING_KEY);
  const redisConfigured = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  const sentryConfigured = Boolean(env.SENTRY_DSN);
  const maintenanceMode = env.MAINTENANCE_MODE === '1';

  let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (!dbConnected || failed >= 5) {
    overallStatus = 'critical';
  } else if (failed > 0 || dbLatencyMs > 500 || (oldestPendingAgeMinutes ?? 0) > 30) {
    overallStatus = 'degraded';
  }

  const serverTimeDhaka = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

  return {
    overallStatus,
    database: {
      status: dbConnected ? 'connected' : 'disconnected',
      latencyMs: dbLatencyMs,
    },
    outbox: {
      pending,
      dispatched,
      failed,
      oldestPendingAgeMinutes,
    },
    inbox: {
      processedCount,
    },
    services: {
      emailProvider,
      emailConfigured,
      storageProvider,
      inngestConfigured,
      redisConfigured,
      sentryConfigured,
      maintenanceMode,
    },
    environment: {
      nodeEnv: env.NODE_ENV,
      appUrl: env.APP_URL,
      serverTimeDhaka,
    },
  };
}
