import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent, scrubTransaction } from '@/lib/observability/scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  beforeSend: (event) => scrubEvent(event),
  beforeSendTransaction: (event) => scrubTransaction(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
