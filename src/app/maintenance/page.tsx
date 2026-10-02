import type { Metadata } from 'next';
import { Wordmark } from '@/components/storefront/wordmark';
import { Button } from '@/components/ui/button';
import { clientEnv } from '@/lib/env.client';
import { conciergeHref } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Back shortly',
  robots: { index: false, follow: false },
};

/** Shown with a 503 while MAINTENANCE_MODE=1. Wordmark only: no navigation to get lost in. */
export default function MaintenancePage() {
  const href = conciergeHref(clientEnv.NEXT_PUBLIC_WHATSAPP_NUMBER);
  return (
    <main
      id="main"
      data-tone="ink"
      className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 py-16 text-center text-fg"
    >
      <Wordmark />
      <p className="mt-16 type-eyebrow text-accent-text">A short pause</p>
      <h1 className="mt-4 max-w-2xl type-display-lg text-fg">We are making a few refinements</h1>
      <p className="mt-6 max-w-md type-body text-fg-muted">
        AUREN is briefly offline. Orders you have already placed are unaffected, and our team will
        keep confirming them personally. Please come back shortly.
      </p>
      <div className="mt-10">
        <Button asChild variant="secondary">
          <a href={href}>Message the concierge</a>
        </Button>
      </div>
    </main>
  );
}
