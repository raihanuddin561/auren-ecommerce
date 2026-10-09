import { z } from 'zod';
import { demoAdminConfigurationError } from '../demo-admin';
import { staffBypassConfigurationError } from '../test-bypass';
import { productionIssues, requiresProductionGuards } from './production';
import { isTrustedProxy } from './proxy-mode';

export { skipsEnvValidation } from './production';

/** Treat blank values (common in .env files and CI) as "not set". */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional());

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Shows the maintenance page on storefront pages (admin and /api keep working)
  MAINTENANCE_MODE: z.preprocess(blankToUndefined, z.enum(['0', '1']).optional()),

  // Bypasses strict third-party production guards (Upstash, Inngest, Resend, Vercel Blob) for preview/demo deployments
  ALLOW_INCOMPLETE_ENV: z.preprocess(blankToUndefined, z.enum(['0', '1']).optional()),
  STRICT_ENV_GUARDS: z.preprocess(blankToUndefined, z.enum(['0', '1']).optional()),

  // Core (required everywhere: the app cannot run or build without them)
  APP_URL: z.preprocess(blankToUndefined, z.url().default('http://localhost:3000')),
  BETTER_AUTH_TRUSTED_ORIGINS: optionalString,
  DATABASE_URL: z
    .url({ message: 'DATABASE_URL must be a postgres connection URL' })
    .refine((v) => /^postgres(ql)?:\/\//.test(v), 'DATABASE_URL must start with postgresql://'),
  DIRECT_URL: optionalUrl,
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  // Versioned secrets for rotation, newest first: `2:<new>,1:<old>`. Read by Better Auth itself;
  // validated here so a typo cannot silently invalidate every session. See docs/runbooks/key-rotation.md.
  BETTER_AUTH_SECRETS: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(
        /^\d+:[^,\s]{32,}(,\d+:[^,\s]{32,})*$/,
        'BETTER_AUTH_SECRETS must look like 2:<secret>,1:<older secret> (each secret 32+ characters)',
      )
      .optional(),
  ),
  // Which proxy headers identify the client address (rate limits, audit). Default: `vercel` on
  // Vercel, `forwarded` outside production, `none` on any other production host.
  TRUSTED_PROXY: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine(isTrustedProxy, 'TRUSTED_PROXY must be vercel, hops:<1-99>, forwarded or none')
      .optional(),
  ),

  // Auth: Google OAuth (optional; the button is hidden when unset)
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  TOTP_ISSUER: z.preprocess(blankToUndefined, z.string().default('AUREN')),

  // Email: Resend in production, SMTP (Mailpit) locally, console log otherwise
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.preprocess(blankToUndefined, z.string().default('AUREN <no-reply@auren.local>')),
  SMTP_URL: optionalUrl,

  // Rate limiting and hot counters (optional: in-memory fallback)
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  // Background jobs (optional: Inngest dev server locally)
  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,
  // Previous signing key, accepted during a rotation window (see docs/runbooks/key-rotation.md).
  INNGEST_SIGNING_KEY_FALLBACK: optionalString,
  INNGEST_BASE_URL: optionalUrl,
  INNGEST_DEV: z.preprocess(blankToUndefined, z.enum(['0', '1']).optional()),

  // Optional network restriction for the owner and finance roles: comma separated IPv4 addresses,
  // IPv4 CIDR ranges and IPv6 addresses (matched at /64). Unset = no restriction.
  PRIVILEGED_IP_ALLOWLIST: optionalString,

  // Optional bearer token that unlocks the detailed /api/health report (monitoring dashboards).
  HEALTH_DETAIL_TOKEN: z.preprocess(blankToUndefined, z.string().min(24).optional()),

  // Observability (optional: disabled when unset)
  SENTRY_DSN: optionalUrl,
  SENTRY_AUTH_TOKEN: optionalString,
  SENTRY_ORG: optionalString,
  SENTRY_PROJECT: optionalString,

  // Bot check on sign-in (optional; both keys or neither). Free Cloudflare Turnstile keys.
  TURNSTILE_SECRET_KEY: optionalString,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,

  // Key for guest order tracking links and the order lookup proof (32+ characters). Falls back to
  // BETTER_AUTH_SECRET, so an existing deployment keeps working; set it separately to rotate one
  // without the other. Changing it invalidates links already emailed to customers.
  ORDER_TOKEN_SECRET: z.preprocess(blankToUndefined, z.string().min(32).optional()),

  // SMS transport for order codes. Only "log" (writes the message to the server log, for local
  // work) exists until a gateway is chosen; production refuses to send real codes with it.
  SMS_PROVIDER: z.preprocess(blankToUndefined, z.enum(['log']).optional()),

  // Couriers (6.7, 6.8). Both are optional: without keys the courier is unavailable and staff use
  // the manual courier (type the courier name and tracking number). The adapters were written from
  // the couriers' public documentation and tested against a fake transport; they have not been
  // run against a live merchant account. Pathao needs all of its keys, Steadfast both of its keys.
  PATHAO_BASE_URL: z.preprocess(blankToUndefined, z.url().default('https://api-hermes.pathao.com')),
  PATHAO_CLIENT_ID: optionalString,
  PATHAO_CLIENT_SECRET: optionalString,
  PATHAO_USERNAME: optionalString,
  PATHAO_PASSWORD: optionalString,
  PATHAO_STORE_ID: optionalString,
  STEADFAST_BASE_URL: z.preprocess(
    blankToUndefined,
    z.url().default('https://portal.packzy.com/api/v1'),
  ),
  STEADFAST_API_KEY: optionalString,
  STEADFAST_SECRET_KEY: optionalString,

  // Media storage (ADR-026): Vercel Blob in production (token required there), the local
  // filesystem in development and tests.
  BLOB_READ_WRITE_TOKEN: optionalString,
  // Folder for locally stored media (git-ignored). Default: .local-media
  MEDIA_LOCAL_DIR: optionalString,

  // Local seed and tests
  SEED_OWNER_EMAIL: z.preprocess(blankToUndefined, z.email().default('owner@auren.local')),
  SEED_OWNER_PASSWORD: optionalString,
  // Local demo only: skips the forced first-login password change for the seeded owner.
  SEED_DEMO_ADMIN: z.preprocess(blankToUndefined, z.enum(['1']).optional()),
  TEST_DATABASE_URL: optionalUrl,
  DB_POOL_MAX: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).default(10)),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.preprocess(blankToUndefined, z.url().default('http://localhost:3000')),
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
  // Concierge button: WhatsApp number in international format (digits, optional +). Optional.
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^\+?[0-9 ()-]{8,20}$/, 'NEXT_PUBLIC_WHATSAPP_NUMBER must be a phone number')
      .optional(),
  ),
});

/** Variables that only make sense as a complete group. */
const groups: ReadonlyArray<{ name: string; keys: readonly string[] }> = [
  { name: 'Google OAuth', keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  { name: 'Turnstile', keys: ['TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY'] },
  { name: 'Upstash Redis', keys: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] },
  { name: 'Inngest Cloud', keys: ['INNGEST_SIGNING_KEY', 'INNGEST_EVENT_KEY'] },
  {
    name: 'Pathao courier',
    keys: [
      'PATHAO_CLIENT_ID',
      'PATHAO_CLIENT_SECRET',
      'PATHAO_USERNAME',
      'PATHAO_PASSWORD',
      'PATHAO_STORE_ID',
    ],
  },
  { name: 'Steadfast courier', keys: ['STEADFAST_API_KEY', 'STEADFAST_SECRET_KEY'] },
];

const fullServerSchema = serverSchema.superRefine((value, ctx) => {
  const record = value as Record<string, unknown>;
  for (const group of groups) {
    const present = group.keys.filter((key) => record[key] !== undefined);
    if (present.length > 0 && present.length < group.keys.length) {
      for (const key of group.keys.filter((k) => record[k] === undefined)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when ${present.join(', ')} is set (${group.name})`,
        });
      }
    }
  }
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

const formatIssues = (error: z.ZodError) =>
  error.issues.map((issue) => {
    const message = /received undefined/.test(issue.message) ? 'is required' : issue.message;
    return `${issue.path.join('.') || '(root)'}: ${message}`;
  });

export function parseServerEnv(rawSource: Record<string, string | undefined>): ServerEnv {
  const source = { ...rawSource };
  source.DATABASE_URL ||= source.POSTGRES_PRISMA_URL || source.POSTGRES_URL;
  source.DIRECT_URL ||= source.POSTGRES_URL_NON_POOLING;

  // On Vercel, populate APP_URL from VERCEL_URL if unset, and ensure TLS on remote DB URLs
  if (source.VERCEL === '1' || source.VERCEL_ENV) {
    if (!source.APP_URL) {
      if (source.VERCEL_PROJECT_PRODUCTION_URL) {
        source.APP_URL = `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`;
      } else if (source.VERCEL_URL) {
        source.APP_URL = `https://${source.VERCEL_URL}`;
      }
    }
    if (!source.NEXT_PUBLIC_APP_URL && source.APP_URL) {
      source.NEXT_PUBLIC_APP_URL = source.APP_URL;
    }
    const appendSsl = (u: string | undefined) => {
      if (!u) return u;
      try {
        const parsed = new URL(u);
        const host = parsed.hostname.toLowerCase();
        if (host !== 'localhost' && host !== '127.0.0.1') {
          if (!parsed.searchParams.has('sslmode') && !parsed.searchParams.has('ssl')) {
            parsed.searchParams.set('sslmode', 'require');
          }
          if (!parsed.searchParams.has('uselibpqcompat')) {
            parsed.searchParams.set('uselibpqcompat', 'true');
          }
          return parsed.toString();
        }
      } catch {}
      return u;
    };
    source.DATABASE_URL = appendSsl(source.DATABASE_URL);
    source.DIRECT_URL = appendSsl(source.DIRECT_URL);
  }

  // Test-only admin bypass: refuse to boot anywhere that is not a local test run.
  const bypassIssue = staffBypassConfigurationError(source);
  if (bypassIssue) throw new EnvValidationError([bypassIssue]);
  if (source.E2E_STAFF_BYPASS === '1') {
    console.warn(
      '[auren] E2E_STAFF_BYPASS is active: admin screens accept a permissionless test identity.',
    );
  }
  // Local demo admin: refuse to boot anywhere that is not a local, non-production run.
  const demoIssue = demoAdminConfigurationError(source);
  if (demoIssue) throw new EnvValidationError([demoIssue]);
  const result = fullServerSchema.safeParse(source);
  if (!result.success) throw new EnvValidationError(formatIssues(result.error));
  if (requiresProductionGuards(source)) {
    const issues = productionIssues(result.data, source);
    if (issues.length > 0) {
      const messages = issues.map((issue) => `${issue.path}: ${issue.message}`);
      if (source.VERCEL === '1' || source.VERCEL_ENV) {
        messages.push(
          'Tip: If this is a preview or staging deployment on Vercel without all SaaS integrations, set ALLOW_INCOMPLETE_ENV=1 in Vercel Project Settings.',
        );
      }
      throw new EnvValidationError(messages);
    }
  }
  return result.data;
}

export function parseClientEnv(rawSource: Record<string, string | undefined>): ClientEnv {
  const source = { ...rawSource };
  if (
    (source.VERCEL === '1' || source.VERCEL_ENV) &&
    !source.NEXT_PUBLIC_APP_URL &&
    source.NEXT_PUBLIC_VERCEL_URL
  ) {
    source.NEXT_PUBLIC_APP_URL = `https://${source.NEXT_PUBLIC_VERCEL_URL}`;
  }
  const result = clientSchema.safeParse(source);
  if (!result.success) throw new EnvValidationError(formatIssues(result.error));
  return result.data;
}

/** Which optional integrations are configured. Callers fall back to no-op or in-memory behaviour. */
export function describeServices(env: ServerEnv) {
  return {
    googleAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    resend: Boolean(env.RESEND_API_KEY),
    smtp: Boolean(env.SMTP_URL),
    redis: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
    inngestCloud: Boolean(env.INNGEST_EVENT_KEY && env.INNGEST_SIGNING_KEY),
    sentry: Boolean(env.SENTRY_DSN),
    vercelBlob: Boolean(env.BLOB_READ_WRITE_TOKEN),
  } as const;
}
