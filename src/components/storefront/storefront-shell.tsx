import { Suspense, type ReactNode } from 'react';
import { ANNOUNCEMENTS } from '@/lib/site';
import { AnnouncementBar } from './announcement-bar';
import { ConciergeButton } from './concierge-button';
import { Footer } from './footer';
import { Header } from './header';

/**
 * Announcement bar, header, footer and concierge button around every storefront page. The header
 * and the concierge button read the current path, which is only known per request on pages with a
 * dynamic address (the shop, collections), so each sits in a Suspense boundary; the header's
 * fallback has the header's height, so nothing moves when it arrives.
 */
export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-fg focus:px-4 focus:py-3 focus:type-eyebrow focus:text-page"
      >
        Skip to content
      </a>
      <AnnouncementBar messages={ANNOUNCEMENTS} />
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="sticky top-0 z-40 h-(--header-height) border-b border-line bg-page"
          />
        }
      >
        <Header />
      </Suspense>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
      <Suspense fallback={null}>
        <ConciergeButton />
      </Suspense>
    </>
  );
}
