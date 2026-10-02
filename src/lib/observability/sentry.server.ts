import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent, scrubTransaction } from './scrub';

// Read from process.env directly: this file also runs in the edge runtime, where lib/env is not allowed.
const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubTransaction(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
});
