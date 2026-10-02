import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs/config';
import { parseClientEnv, parseServerEnv } from './src/lib/env/schema';
import { securityHeaders } from './src/lib/security/headers';

// Fail `next dev` and `next build` early, with a readable message, when configuration is missing.
if (process.env.SKIP_ENV_VALIDATION !== '1') {
  parseServerEnv(process.env);
  parseClientEnv(process.env);
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders({
          isDev: process.env.NODE_ENV === 'development',
          isProduction: process.env.NODE_ENV === 'production',
          appUrl: process.env.APP_URL ?? 'http://localhost:3000',
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        }),
      },
    ];
  },
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
  sourcemaps: { disable: !uploadSourceMaps },
});
