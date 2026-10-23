'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { ImageFrame } from '@/components/motion/image-frame';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { IconButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { NavItem } from '@/lib/site';
import { Wordmark } from './wordmark';
import { LanguageSwitcher } from './language-switcher';
import { useTranslation } from '@/lib/i18n/context';

interface MobileMenuProps {
  items: NavItem[];
  onOpenFemme?: () => void;
}

const bigLink =
  'flex min-h-14 items-center border-b border-line type-h1 text-fg transition-auren-fast hover:text-accent-text';

/** Full-screen menu: large serif links, expandable categories, a featured image. */
export function MobileMenu({ items, onOpenFemme }: MobileMenuProps) {
  const { translateNav, isBn } = useTranslation();
  const featured = items.find((item) => item.tile)?.tile;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <IconButton aria-label="Open menu" className="lg:hidden">
          <Icon icon={Menu} />
        </IconButton>
      </SheetTrigger>
      <SheetContent
        side="full"
        hideClose={false}
        className="bg-page"
        aria-describedby="mobile-menu-description"
      >
        <div className="flex h-14 items-center justify-center border-b border-line px-16">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription id="mobile-menu-description" className="sr-only">
            Browse the collection and find customer care.
          </SheetDescription>
          <SheetClose asChild>
            <Wordmark />
          </SheetClose>
        </div>

        <nav aria-label="Mobile" className="flex flex-1 flex-col overflow-y-auto px-5 pb-10">
          {/* Department Switcher */}
          <div className="mt-4 grid grid-cols-2 gap-2 border-b border-line pb-4">
            <div className="flex items-center justify-center gap-1.5 rounded-xs border border-gold/60 bg-gold/5 py-2.5 type-eyebrow font-medium tracking-eyebrow text-fg">
              <span>Homme</span>
              <span className="size-1 rounded-full bg-gold" />
            </div>
            <button
              type="button"
              onClick={() => {
                onOpenFemme?.();
              }}
              className="flex items-center justify-center gap-1.5 rounded-xs border border-line bg-raised/50 py-2.5 type-eyebrow font-medium tracking-eyebrow text-fg-muted transition-colors hover:border-gold hover:text-fg"
            >
              <span>Femme</span>
              <span className="rounded-xs border border-gold/40 bg-gold/10 px-1.5 py-0.5 type-caption font-mono text-accent-text uppercase">
                {isBn ? 'প্রিভিউ' : 'Preview'}
              </span>
            </button>
          </div>

          <Accordion type="single" collapsible className="mt-2">
            {items.map((item) =>
              item.columns?.length ? (
                <AccordionItem key={item.label} value={item.label} className="border-b-0">
                  <AccordionTrigger
                    className={`${bigLink} w-full justify-between py-0 type-h1 font-normal tracking-normal normal-case`}
                  >
                    {translateNav(item.label)}
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <ul className="flex flex-col gap-1 pl-1">
                      <li>
                        <SheetClose asChild>
                          <Link
                            href={item.href}
                            className="flex min-h-11 items-center type-body text-fg"
                          >
                            {isBn
                              ? `সব ${translateNav(item.label)}`
                              : `All ${item.label.toLowerCase()}`}
                          </Link>
                        </SheetClose>
                      </li>
                      {item.columns.flatMap((column) =>
                        column.links.map((link) => (
                          <li key={`${column.heading}-${link.label}`}>
                            <SheetClose asChild>
                              <Link
                                href={link.href}
                                className="flex min-h-11 items-center type-body text-fg-muted hover:text-fg"
                              >
                                {translateNav(link.label)}
                              </Link>
                            </SheetClose>
                          </li>
                        )),
                      )}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ) : (
                <div key={item.label}>
                  <SheetClose asChild>
                    <Link href={item.href} className={bigLink}>
                      {translateNav(item.label)}
                    </Link>
                  </SheetClose>
                </div>
              ),
            )}
          </Accordion>

          {featured ? (
            <SheetClose asChild>
              <Link
                href={featured.href}
                className="group mt-8 grid grid-cols-[7rem_1fr] items-end gap-4"
              >
                <ImageFrame src={featured.image} alt={featured.imageAlt} sizes="112px" />
                <span>
                  <span className="block type-eyebrow text-accent-text">
                    {translateNav(featured.eyebrow)}
                  </span>
                  <span className="mt-1 block type-h3 font-display font-normal text-fg">
                    {translateNav(featured.title)}
                  </span>
                </span>
              </Link>
            </SheetClose>
          ) : null}

          <div className="mt-auto pt-6">
            <LanguageSwitcher variant="mobile" />

            <ul className="mt-4 flex flex-col">
              {[
                { label: translateNav('Track your order'), href: '/track' },
                { label: translateNav('Wishlist'), href: '/wishlist' },
              ].map((link) => (
                <li key={link.href}>
                  <SheetClose asChild>
                    <Link
                      href={link.href}
                      className="flex min-h-11 items-center type-small text-fg-muted hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
