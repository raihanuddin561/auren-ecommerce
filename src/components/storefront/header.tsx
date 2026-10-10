'use client';

import { Heart, Search, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { hasHeroHeader, PRIMARY_NAV, type NavItem } from '@/lib/site';
import { MegaMenu } from './mega-menu';
import { MobileMenu } from './mobile-menu';
import { BagButton } from './cart/bag-button';
import { SearchOverlay } from './search/search-overlay';
import { Wordmark } from './wordmark';

/** Scroll distance after which a transparent header turns solid. */
export const HEADER_SOLID_AFTER_PX = 80;

function subscribeToScroll(onChange: () => void): () => void {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}

function useScrolledPast(threshold: number): boolean {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > threshold,
    () => false,
  );
}

const iconLink =
  'touch-target relative inline-flex size-11 items-center justify-center text-fg transition-all duration-200 hover:text-gold hover:scale-105 active:scale-95';

export interface HeaderProps {
  items?: NavItem[];
}

/**
 * Transparent over a hero (home) until the visitor scrolls 80px or opens a menu, then ivory with a
 * hairline border and frosted glass backdrop. On every other page it is solid from the start.
 */
export function Header({ items = PRIMARY_NAV }: HeaderProps = {}) {
  const pathname = usePathname();
  const scrolled = useScrolledPast(HEADER_SOLID_AFTER_PX);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const overHero = hasHeroHeader(pathname);
  const transparent = overHero && !scrolled && openPanel === null;

  return (
    <>
      <header
        data-tone={transparent ? 'ink' : undefined}
        data-transparent={transparent}
        className={cn(
          'sticky top-0 z-40 h-(--header-height) text-fg transition-auren',
          overHero && '-mb-(--header-height)',
          transparent
            ? 'border-b border-transparent bg-transparent'
            : 'shadow-2xs border-b border-line/70 bg-page/90 backdrop-blur-md',
        )}
      >
        {openPanel ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-full -z-10 h-dvh animate-fade-in bg-ink/30"
          />
        ) : null}
        <div className="container-page grid h-full grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center">
            <MobileMenu items={items} />
            <MegaMenu
              items={items}
              pathname={pathname}
              openLabel={openPanel}
              onOpenChange={setOpenPanel}
            />
          </div>

          <Wordmark />

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search collection"
              className={iconLink}
            >
              <Icon icon={Search} />
            </button>
            <Link
              href="/account"
              aria-label="Account"
              className={cn(iconLink, 'hidden sm:inline-flex')}
            >
              <Icon icon={User} />
            </Link>
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className={cn(iconLink, 'hidden sm:inline-flex')}
            >
              <Icon icon={Heart} />
            </Link>
            <BagButton className={iconLink} />
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
