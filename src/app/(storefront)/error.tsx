'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** A page failed to render: say so calmly, keep the header and footer, offer a retry. */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section
      role="alert"
      className="container-editorial flex flex-1 flex-col items-start justify-center py-24 md:py-32"
    >
      <p className="type-eyebrow text-accent-text">Something went wrong</p>
      <h1 className="mt-4 type-display-lg text-fg">We could not show this page</h1>
      <p className="mt-5 max-w-md type-body text-fg-muted">
        We have been told and are looking into it. Please try again in a moment. If you were placing
        an order, check your email before trying again, or message our concierge.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <Button asChild variant="link">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load clears the failed render state */}
          <a href="/">Return home</a>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-10 type-small text-fg-muted">Reference: {error.digest}</p>
      ) : null}
    </section>
  );
}
