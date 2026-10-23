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
import { FemmePreviewDialog } from './femme-preview-dialog';
import { Wordmark } from './wordmark';
import { LanguageSwitcher } from './language-switcher';
import { useTranslation } from '@/lib/i18n/context';

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
  const { dictionary } = useTranslation();
  const scrolled = useScrolledPast(HEADER_SOLID_AFTER_PX);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [femmeOpen, setFemmeOpen] = useState(false);

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
          <div className="flex items-center gap-6">
            <MobileMenu items={items} onOpenFemme={() => setFemmeOpen(true)} />
            <div className="hidden items-center gap-5 lg:flex">
              <div className="flex items-center gap-3 border-r border-line/60 pr-5 type-eyebrow font-medium tracking-eyebrow">
                <span className="relative flex cursor-default items-center gap-1.5 text-fg">
                  <span>Homme</span>
                  <span className="size-1 rounded-full bg-gold" aria-hidden="true" />
                </span>
                <button
                  type="button"
                  onClick={() => setFemmeOpen(true)}
                  className="group relative flex items-center gap-1.5 text-fg-muted transition-colors hover:text-accent-text"
                >
                  <span>Femme</span>
                  <span className="rounded-xs border border-gold/40 bg-gold/10 px-1.5 py-0.5 type-caption font-mono text-accent-text uppercase transition-colors group-hover:border-gold group-hover:bg-gold/20">
                    Preview
                  </span>
                </button>
              </div>
              <MegaMenu
                items={items}
                pathname={pathname}
                openLabel={openPanel}
                onOpenChange={setOpenPanel}
              />
            </div>
          </div>

          <Wordmark />

          <div className="flex items-center justify-end">
            <LanguageSwitcher className="mr-1 hidden sm:inline-flex" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={dictionary.header.search}
              className={iconLink}
            >
              <Icon icon={Search} />
            </button>
            <Link
              href="/account"
              aria-label={dictionary.header.account}
              className={cn(iconLink, 'hidden sm:inline-flex')}
            >
              <Icon icon={User} />
            </Link>
            <Link
              href="/wishlist"
              aria-label={dictionary.header.wishlist}
              className={cn(iconLink, 'hidden sm:inline-flex')}
            >
              <Icon icon={Heart} />
            </Link>
            <BagButton className={iconLink} />
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <FemmePreviewDialog open={femmeOpen} onOpenChange={setFemmeOpen} />
    </>
  );
}
