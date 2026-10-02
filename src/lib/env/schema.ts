import { z } from 'zod';
import { staffBypassConfigurationError } from '../test-bypass';

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

  // Core (required everywhere: the app cannot run or build without them)
  APP_URL: z.preprocess(blankToUndefined, z.url().default('http://localhost:3000')),
  DATABASE_URL: z
    .url({ message: 'DATABASE_URL must be a postgres connection URL' })
    .refine((v) => /^postgres(ql)?:\/\//.test(v), 'DATABASE_URL must start with postgresql://'),
  DIRECT_URL: optionalUrl,
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  // Which proxy headers identify the client address (rate limits, audit). Default: `vercel` on
  // Vercel, `forwarded` outside production, `none` on any other production host.
  TRUSTED_PROXY: z.preprocess(blankToUndefined, z.enum(['vercel', 'forwarded', 'none']).optional()),

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
  INNGEST_BASE_URL: optionalUrl,
  INNGEST_DEV: z.preprocess(blankToUndefined, z.enum(['0', '1']).optional()),

  // Observability (optional: disabled when unset)
  SENTRY_DSN: optionalUrl,
  SENTRY_AUTH_TOKEN: optionalString,
  SENTRY_ORG: optionalString,
  SENTRY_PROJECT: optionalString,

  // Media (used from the catalog work onward; optional now)
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  // Local seed and tests
  SEED_OWNER_EMAIL: z.preprocess(blankToUndefined, z.email().default('owner@auren.local')),
  SEED_OWNER_PASSWORD: optionalString,
  TEST_DATABASE_URL: optionalUrl,
  DB_POOL_MAX: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).default(10)),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.preprocess(blankToUndefined, z.url().default('http://localhost:3000')),
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
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
  { name: 'Upstash Redis', keys: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] },
  {
    name: 'Cloudinary',
    keys: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
  },
];

const isLocalUrl = (url: string) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);

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
  // A placeholder secret is fine for a local production build (`next build && next start`),
  // but never for a deployment that serves a real domain.
  if (value.NODE_ENV === 'production' && !isLocalUrl(value.APP_URL)) {
    if (value.BETTER_AUTH_SECRET.startsWith('dev-')) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: 'BETTER_AUTH_SECRET must not be a development placeholder in production',
      });
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

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  // The public URL feeds HSTS, canonical URLs and auth callbacks: never fall back to localhost
  // on a real production deployment.
  if (source.VERCEL_ENV === 'production' && !source.APP_URL?.trim()) {
    throw new EnvValidationError(['APP_URL: is required on a production deployment']);
  }
  // Test-only admin bypass: refuse to boot anywhere that is not a local test run.
  const bypassIssue = staffBypassConfigurationError(source);
  if (bypassIssue) throw new EnvValidationError([bypassIssue]);
  if (source.E2E_STAFF_BYPASS === '1') {
    console.warn(
      '[auren] E2E_STAFF_BYPASS is active: admin screens accept a permissionless test identity.',
    );
  }
  const result = fullServerSchema.safeParse(source);
  if (!result.success) throw new EnvValidationError(formatIssues(result.error));
  return result.data;
}

export function parseClientEnv(source: Record<string, string | undefined>): ClientEnv {
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
    cloudinary: Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
    ),
  } as const;
}
