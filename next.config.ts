import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { withSentryConfig } from '@sentry/nextjs/config';
import { parseClientEnv, parseServerEnv, skipsEnvValidation } from './src/lib/env/schema';
import { parseAllowlist } from './src/lib/ip-allowlist';
import { headerRules } from './src/lib/security/headers';

/**
 * Fail `next dev`, `next build` and `next start` early, with a readable message, when configuration
 * is missing. Production-only guards (real https URL, strong secret, Upstash, Inngest keys, email
 * provider, trusted proxy) are skipped for the build step, which runs without runtime secrets.
 */
function validateEnvironment(phase: string): void {
  const source: Record<string, string | undefined> = { ...process.env };
  if (phase === PHASE_PRODUCTION_BUILD) source.NEXT_PHASE = PHASE_PRODUCTION_BUILD;
  if (skipsEnvValidation(source)) return;
  parseServerEnv(source);
  parseClientEnv(source);
  // A typo here would silently lock the owner and finance roles out at runtime: fail the deploy.
  if (parseAllowlist(source.PRIVILEGED_IP_ALLOWLIST) === null) {
    throw new Error(
      'PRIVILEGED_IP_ALLOWLIST is not valid: use comma separated IPv4 addresses, IPv4 CIDR ranges or IPv6 addresses',
    );
  }
}

const buildConfig = (): NextConfig => ({
  cacheComponents: true,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return headerRules({
      isDev: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
      appUrl: process.env.APP_URL?.trim() || 'http://localhost:3000',
      sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    });
  },
});

const nextConfig = (phase: string): NextConfig => {
  validateEnvironment(phase);
  return buildConfig();
};

// Source maps are uploaded only when the auth token, org and project exist (CI/Vercel).
// Without them the wrapper still builds and the SDK stays inert unless a DSN is set.
const uploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  // Maps are uploaded to Sentry and then removed, so they are never served to the public.
  sourcemaps: { disable: !uploadSourceMaps, deleteSourcemapsAfterUpload: true },
});
