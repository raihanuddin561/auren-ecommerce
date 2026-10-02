'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Something in a console screen failed to render. Access problems are handled by the layout. */
export default function AdminError({
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
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center"
    >
      <h1 className="type-h2 font-sans font-medium text-fg">This screen could not be shown</h1>
      <p className="type-admin text-fg-muted">
        The error has been recorded. Try again, and tell the owner if it keeps happening.
      </p>
      <Button onClick={reset} variant="secondary" size="sm">
        Try again
      </Button>
      {error.digest ? <p className="type-small text-fg-muted">Reference: {error.digest}</p> : null}
    </section>
  );
}
