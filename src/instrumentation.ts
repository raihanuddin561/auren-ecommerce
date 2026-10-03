import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Validate the environment when the server boots (serverless platforms never load next.config).
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('@/lib/env');
  // Both runtimes load the same configuration; each only initialises when SENTRY_DSN is set.
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    await import('@/lib/observability/sentry.server');
  }
}

export const onRequestError = Sentry.captureRequestError;
