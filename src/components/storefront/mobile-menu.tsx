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

interface MobileMenuProps {
  items: NavItem[];
}

const bigLink =
  'flex min-h-14 items-center border-b border-line type-h1 text-fg transition-auren-fast hover:text-accent-text';

/** Full-screen menu: large serif links, expandable categories, a featured image. */
export function MobileMenu({ items }: MobileMenuProps) {
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
          <Accordion type="single" collapsible className="mt-2">
            {items.map((item) =>
              item.columns?.length ? (
                <AccordionItem key={item.label} value={item.label} className="border-b-0">
                  <AccordionTrigger
                    className={`${bigLink} w-full justify-between py-0 type-h1 font-normal tracking-normal normal-case`}
                  >
                    {item.label}
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <ul className="flex flex-col gap-1 pl-1">
                      <li>
                        <SheetClose asChild>
                          <Link
                            href={item.href}
                            className="flex min-h-11 items-center type-body text-fg"
                          >
                            All {item.label.toLowerCase()}
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
                                {link.label}
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
                      {item.label}
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
                  <span className="block type-eyebrow text-accent-text">{featured.eyebrow}</span>
                  <span className="mt-1 block type-h3 font-display font-normal text-fg">
                    {featured.title}
                  </span>
                </span>
              </Link>
            </SheetClose>
          ) : null}

          <ul className="mt-auto flex flex-col pt-8">
            {[
              { label: 'Track your order', href: '/track' },
              { label: 'Wishlist', href: '/wishlist' },
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
        </nav>
      </SheetContent>
    </Sheet>
  );
}
