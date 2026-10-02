import type { ReactNode } from 'react';
import { ANNOUNCEMENTS } from '@/lib/site';
import { AnnouncementBar } from './announcement-bar';
import { ConciergeButton } from './concierge-button';
import { Footer } from './footer';
import { Header } from './header';

/** Announcement bar, header, footer and concierge button around every storefront page. */
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
      <Header />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
      <ConciergeButton />
    </>
  );
}
