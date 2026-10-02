'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Last-resort boundary: replaces the root layout when it fails to render, so the stylesheet and
 * web fonts may be missing. Everything is inline on purpose and uses the same brand values.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#f6f2eb',
          color: '#0f0f0f',
          fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
        }}
      >
        <main style={{ maxWidth: 460, padding: 24, textAlign: 'center' }}>
          <p style={{ letterSpacing: '0.32em', fontSize: 18, fontWeight: 500, margin: 0 }}>AUREN</p>
          <h1 style={{ fontWeight: 400, fontSize: 34, lineHeight: 1.15, margin: '48px 0 16px' }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 16,
              lineHeight: 1.65,
              color: '#55514a',
              margin: 0,
            }}
          >
            We have been told and are looking into it. Please try again. If you were placing an
            order, check your email before trying again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              minHeight: 48,
              padding: '0 32px',
              background: '#0f0f0f',
              color: '#f6f2eb',
              border: 0,
              borderRadius: 2,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: 13,
                color: '#6b665d',
                marginTop: 40,
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
