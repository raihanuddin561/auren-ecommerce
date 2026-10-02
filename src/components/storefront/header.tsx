'use client';

import { Heart, Search, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import { hasHeroHeader, PRIMARY_NAV } from '@/lib/site';
import { MegaMenu } from './mega-menu';
import { MobileMenu } from './mobile-menu';
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

interface HeaderProps {
  /** Items in the bag. Comes from the cart once it exists. */
  bagCount?: number;
}

const iconLink =
  'touch-target relative inline-flex size-11 items-center justify-center text-fg transition-auren-fast hover:text-accent-text';

/**
 * Transparent over a hero (home) until the visitor scrolls 80px or opens a menu, then ivory with a
 * hairline border. On every other page it is solid from the start.
 */
export function Header({ bagCount = 0 }: HeaderProps) {
  const pathname = usePathname();
  const scrolled = useScrolledPast(HEADER_SOLID_AFTER_PX);
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const overHero = hasHeroHeader(pathname);
  const transparent = overHero && !scrolled && openPanel === null;

  return (
    <header
      data-tone={transparent ? 'ink' : undefined}
      data-transparent={transparent}
      className={cn(
        'sticky top-0 z-40 h-(--header-height) text-fg transition-auren',
        overHero && '-mb-(--header-height)',
        transparent ? 'border-b border-transparent bg-transparent' : 'border-b border-line bg-page',
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
          <MobileMenu items={PRIMARY_NAV} />
          <MegaMenu
            items={PRIMARY_NAV}
            pathname={pathname}
            openLabel={openPanel}
            onOpenChange={setOpenPanel}
          />
        </div>

        <Wordmark />

        <div className="flex items-center justify-end">
          <Link href="/search" aria-label="Search" className={iconLink}>
            <Icon icon={Search} />
          </Link>
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
          <Link
            href="/cart"
            aria-label={
              bagCount > 0 ? `Bag, ${bagCount} ${bagCount === 1 ? 'item' : 'items'}` : 'Bag, empty'
            }
            className={iconLink}
          >
            <Icon icon={ShoppingBag} />
            {bagCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-0.5 inline-flex min-w-4 items-center justify-center bg-gold px-1 py-0.5 text-eyebrow leading-none text-ink tabular-nums"
              >
                {bagCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
