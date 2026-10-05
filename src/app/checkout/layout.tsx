import type { Metadata } from 'next';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { connection } from 'next/server';
import { Wordmark } from '@/components/storefront/wordmark';
import { Icon } from '@/components/ui/icon';
import { clientEnv } from '@/lib/env.client';
import { conciergeHref } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

/**
 * Checkout is rendered per request, never prerendered: its Content-Security-Policy carries a
 * per-request nonce (ADR-022), which a static shell cannot receive. `instant = false` allows this
 * blocking route.
 */
export const instant = false;

/** Distraction-free: the wordmark, a way back to the bag, and nothing else to click away to. */
export default async function CheckoutLayout({ children }: LayoutProps<'/checkout'>) {
  await connection();
  const concierge = conciergeHref(clientEnv.NEXT_PUBLIC_WHATSAPP_NUMBER);
  return (
    <div className="flex min-h-dvh flex-col bg-page text-fg">
      <header className="border-b border-line">
        <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center">
          <Link
            href="/cart"
            className="inline-flex min-h-11 items-center type-small text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Back to bag
          </Link>
          <Wordmark />
          <p className="flex items-center justify-end gap-2 type-small text-fg-muted">
            <Icon icon={Lock} size={14} />
            <span className="hidden sm:inline">Secure checkout</span>
            <span className="sr-only sm:hidden">Secure checkout</span>
          </p>
        </div>
      </header>
      <main id="main" className="container-page flex-1 py-10 md:py-16">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-6 type-small text-fg-muted">
          <p>Every order is confirmed by our team before it is prepared.</p>
          <a
            href={concierge}
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-fg"
          >
            Need help? Message our concierge
          </a>
        </div>
      </footer>
    </div>
  );
}
