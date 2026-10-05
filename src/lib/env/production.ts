/**
 * Production boot guards. Pure functions: no server-only imports, so next.config.ts can use them.
 * A production server refuses to start when a security-critical setting is missing or still a
 * development value (see ARCHITECTURE section 11 and docs/runbooks/key-rotation.md).
 */

type Source = Record<string, string | undefined>;

export const isLocalUrl = (url: string): boolean => {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

/** Hosts that are only reachable from the machine or compose network that runs the app. */
export const isLocalHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === 'mailpit' ||
    host === 'host.docker.internal' ||
    /^127\./.test(host)
  );
};

/** Secrets that ship in the repository, in examples or in CI. Never acceptable in production. */
const SECRET_DENYLIST = [
  /(^|[-_ ])(dev|ci|test|e2e|example|sample|demo|local|default)([-_ ]|$)/i,
  /change[-_ ]?me|replace[-_ ]?me|placeholder|todo|password|your[-_ ]|xxxx/i,
  /0123456789abcdef/i,
];

/** Three or more characters in a row that count up or repeat (abc, 123, aaa). */
const hasSequentialRun = (value: string): boolean => {
  const lower = value.toLowerCase();
  let run = 1;
  for (let i = 1; i < lower.length; i++) {
    const step = lower.charCodeAt(i) - lower.charCodeAt(i - 1);
    if (step === 1 || step === 0) run += 1;
    else run = 1;
    if (run >= 6) return true;
  }
  return false;
};

/** Shannon entropy in bits per character. */
export function entropyBitsPerChar(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** Why a signing secret is unfit for production, or null when it is acceptable. */
export function weakSecretReason(rawSecret: string): string | null {
  const secret = rawSecret.trim();
  if (SECRET_DENYLIST.some((pattern) => pattern.test(secret))) {
    return 'looks like a development or example value';
  }
  if (secret.length < 32) return 'is shorter than 32 characters';
  if (hasSequentialRun(secret)) return 'contains long sequential or repeated runs';
  if (new Set(secret).size < 12) return 'uses too few distinct characters';
  if (entropyBitsPerChar(secret) < 3)
    return 'has too little entropy (use `openssl rand -base64 32`)';
  return null;
}

/** `next build` evaluates the app with production settings but without runtime secrets. */
export const isBuildPhase = (source: Source): boolean =>
  source.NEXT_PHASE === 'phase-production-build';

/**
 * SKIP_ENV_VALIDATION=1 exists for tooling and for `next build` on machines that have no secrets.
 * A production server ignores it, so a leftover flag cannot switch the guards off.
 */
export function skipsEnvValidation(source: Source): boolean {
  if (source.SKIP_ENV_VALIDATION !== '1') return false;
  return source.NODE_ENV !== 'production' || isBuildPhase(source);
}

/**
 * Production on a real host. The only exemption is an explicit local production run
 * (next build then next start, used by the browser tests): LOCAL_PRODUCTION=1 together with a
 * localhost APP_URL. Naming localhost alone does not switch the guards off, and Vercel is never
 * local.
 */
export function requiresProductionGuards(source: Source): boolean {
  if (source.NODE_ENV !== 'production' || isBuildPhase(source)) return false;
  if (source.ALLOW_INCOMPLETE_ENV === '1' || source.STRICT_ENV_GUARDS === '0') return false;
  const onVercel = source.VERCEL === '1' || Boolean(source.VERCEL_ENV);
  const explicitUrl = source.APP_URL?.trim();
  const localRun = source.LOCAL_PRODUCTION === '1' && !!explicitUrl && isLocalUrl(explicitUrl);
  return onVercel || !localRun;
}

export interface ProductionIssue {
  path: string;
  message: string;
}

interface ProductionValues {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_SECRETS?: string | undefined;
  EMAIL_FROM: string;
  RESEND_API_KEY?: string | undefined;
  SMTP_URL?: string | undefined;
  UPSTASH_REDIS_REST_URL?: string | undefined;
  UPSTASH_REDIS_REST_TOKEN?: string | undefined;
  INNGEST_SIGNING_KEY?: string | undefined;
  INNGEST_EVENT_KEY?: string | undefined;
  INNGEST_DEV?: string | undefined;
  INNGEST_BASE_URL?: string | undefined;
  TRUSTED_PROXY?: string | undefined;
  BLOB_READ_WRITE_TOKEN?: string | undefined;
  DB_POOL_MAX?: number | undefined;
}

const SSL_MODES = new Set(['require', 'verify-ca', 'verify-full']);

const databaseUrl = (raw: string | undefined): URL | null => {
  try {
    return raw ? new URL(raw) : null;
  } catch {
    return null;
  }
};

const encrypted = (url: URL): boolean =>
  SSL_MODES.has(url.searchParams.get('sslmode') ?? '') || url.searchParams.get('ssl') === 'true';

/**
 * Production database settings (Supabase, ADR-025): the application connects through the
 * transaction pooler (port 6543) and migrations through a direct or session connection (5432);
 * both must use TLS, and they must be two different URLs.
 */
function databaseIssues(source: Source, add: (path: string, message: string) => void): void {
  const pooled = databaseUrl(source.DATABASE_URL);
  const direct = databaseUrl(source.DIRECT_URL);
  if (!direct) {
    add(
      'DIRECT_URL',
      'is required in production (the direct or session connection for migrations)',
    );
  } else if (source.DIRECT_URL === source.DATABASE_URL) {
    add(
      'DIRECT_URL',
      'must differ from DATABASE_URL: runtime uses the pooler, migrations the direct connection',
    );
  }
  for (const [name, url] of [
    ['DATABASE_URL', pooled],
    ['DIRECT_URL', direct],
  ] as const) {
    if (!url) continue;
    if (isLocalHost(url.hostname)) add(name, 'must not point at a local database in production');
    else if (!encrypted(url)) add(name, 'must require TLS: add ?sslmode=require');
  }
  const supabase = (url: URL | null) => Boolean(url && /supabase\.(com|co)$/.test(url.hostname));
  if (supabase(pooled) && pooled!.port !== '6543') {
    add('DATABASE_URL', 'must use the Supabase transaction pooler (port 6543)');
  }
  if (supabase(direct) && direct!.port === '6543') {
    add(
      'DIRECT_URL',
      'must be the direct or session connection (port 5432), not the transaction pooler',
    );
  }
  const pool = Number(source.DB_POOL_MAX ?? 10);
  if (pool > 10)
    add('DB_POOL_MAX', 'keep it at 10 or less per instance in production (the pooler multiplexes)');
}

export function productionIssues(value: ProductionValues, source: Source): ProductionIssue[] {
  const issues: ProductionIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const appUrl = source.APP_URL?.trim();

  if (!appUrl) add('APP_URL', 'is required in production (explicit https URL)');
  else if (!appUrl.startsWith('https://') || isLocalUrl(appUrl)) {
    add('APP_URL', 'must be an https URL of the public site in production');
  }

  const publicUrl = source.NEXT_PUBLIC_APP_URL?.trim();
  const trimSlash = (url: string) => url.replace(/\/+$/, '');
  if (!publicUrl || !appUrl || trimSlash(publicUrl) !== trimSlash(appUrl)) {
    add('NEXT_PUBLIC_APP_URL', 'must be set and equal to APP_URL in production');
  }

  databaseIssues(source, add);
  if (!value.BLOB_READ_WRITE_TOKEN) {
    add('BLOB_READ_WRITE_TOKEN', 'is required in production (Vercel Blob media storage)');
  }

  const weak = weakSecretReason(value.BETTER_AUTH_SECRET);
  if (weak) add('BETTER_AUTH_SECRET', `must not be used in production: it ${weak}`);
  for (const entry of value.BETTER_AUTH_SECRETS?.split(',') ?? []) {
    const reason = weakSecretReason(entry.slice(entry.indexOf(':') + 1));
    if (reason)
      add(
        'BETTER_AUTH_SECRETS',
        `contains a secret that must not be used in production: it ${reason}`,
      );
  }

  if (!(value.UPSTASH_REDIS_REST_URL && value.UPSTASH_REDIS_REST_TOKEN)) {
    add('UPSTASH_REDIS_REST_URL', 'Upstash Redis is required in production (shared rate limits)');
  }

  if (!value.INNGEST_SIGNING_KEY) add('INNGEST_SIGNING_KEY', 'is required in production');
  if (!value.INNGEST_EVENT_KEY) add('INNGEST_EVENT_KEY', 'is required in production');
  if (value.INNGEST_DEV === '1') add('INNGEST_DEV', 'must not be 1 in production');
  if (value.INNGEST_BASE_URL) {
    add('INNGEST_BASE_URL', 'must not be set in production (events go to Inngest Cloud)');
  }

  const smtpIsReal = value.SMTP_URL
    ? !isLocalHost(new URL(value.SMTP_URL.replace(/^smtps?:/i, 'http:')).hostname)
    : false;
  if (!value.RESEND_API_KEY && !smtpIsReal) {
    add(
      'RESEND_API_KEY',
      'an email provider (Resend or a non-local SMTP_URL) is required in production',
    );
  }
  if (
    /(\.(local|test|invalid|localhost)|@example\.(com|org|net))>?$/i.test(value.EMAIL_FROM.trim())
  ) {
    add('EMAIL_FROM', 'must use a real sending domain in production');
  }

  // Local-only bootstrap values: a demo owner or a seed password never belongs on a real host.
  if ((source.SEED_DEMO_ADMIN ?? '').trim() !== '') {
    add('SEED_DEMO_ADMIN', 'must not be set in production (local demo only)');
  }
  if ((source.SEED_OWNER_PASSWORD ?? '').trim() !== '') {
    add(
      'SEED_OWNER_PASSWORD',
      'must not be set in production: create the owner with `pnpm owner:create` and remove it',
    );
  }

  const proxy = value.TRUSTED_PROXY;
  if (proxy === 'none' || proxy === 'forwarded') {
    add(
      'TRUSTED_PROXY',
      proxy === 'none'
        ? 'must not be `none` in production: rate limits would share one bucket'
        : 'must not be `forwarded` in production: the client chooses the left-most address (use vercel or hops:N)',
    );
  } else if (!proxy && source.VERCEL !== '1') {
    add(
      'TRUSTED_PROXY',
      'must be set (`vercel` or `hops:N`) in production off Vercel: client addresses would be unknown',
    );
  }
  return issues;
}
