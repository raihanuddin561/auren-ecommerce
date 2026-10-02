'use client';

import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import type { NavItem } from '@/lib/site';

interface MegaMenuProps {
  items: NavItem[];
  pathname: string;
  /** Label of the open panel, or null. Lifted so the header can turn solid while a panel is open. */
  openLabel: string | null;
  onOpenChange: (label: string | null) => void;
}

const HOVER_CLOSE_DELAY_MS = 140;

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const topLevelClass =
  'relative inline-flex min-h-11 items-center gap-1 type-eyebrow text-fg transition-auren-fast hover:text-accent-text';

/**
 * Desktop navigation. Items with columns open a full-width panel using the disclosure pattern:
 * a button with aria-expanded, opened by click, Enter, Space or hover; closed by Escape (focus
 * returns to the button), by moving focus out, or by choosing a link.
 */
export function MegaMenu({ items, pathname, openLabel, onOpenChange }: MegaMenuProps) {
  const baseId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const cancelClose = useCallback(() => window.clearTimeout(closeTimer.current), []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => onOpenChange(null), HOVER_CLOSE_DELAY_MS);
  }, [cancelClose, onOpenChange]);

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!openLabel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onOpenChange(null);
      rootRef.current?.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openLabel, onOpenChange]);

  return (
    <nav
      ref={rootRef}
      aria-label="Primary"
      className="hidden lg:block"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
      onBlur={(event) => {
        // Only when focus lands on another element outside the menu; clicks on panel padding give a
        // null relatedTarget and the outside-pointer handler covers real outside clicks.
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          onOpenChange(null);
        }
      }}
    >
      <ul className="flex items-center gap-8">
        {items.map((item) => {
          const hasPanel = Boolean(item.columns?.length);
          const open = openLabel === item.label;
          const panelId = `${baseId}-${item.label}`;
          const active = isActive(pathname, item.href);

          return (
            <li
              key={item.label}
              onPointerEnter={(event) => {
                // Hover opens panels for a mouse only; touch and pen use the click.
                if (hasPanel && event.pointerType === 'mouse') {
                  cancelClose();
                  onOpenChange(item.label);
                }
              }}
            >
              {hasPanel ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={(event) => {
                    // A mouse click (detail > 0) after hover must not close the panel it just opened;
                    // keyboard activation (detail 0) toggles.
                    onOpenChange(open && event.detail === 0 ? null : item.label);
                  }}
                  className={cn(topLevelClass, active && 'text-fg')}
                >
                  {item.label}
                  <Icon
                    icon={ChevronDown}
                    size={14}
                    className={cn(
                      'transition-transform duration-(--dur-base) ease-auren',
                      open && 'rotate-180',
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute right-0 bottom-2 left-0 h-px bg-gold opacity-0 transition-auren',
                      (open || active) && 'opacity-100',
                    )}
                  />
                </button>
              ) : (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onOpenChange(null)}
                  className={topLevelClass}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute right-0 bottom-2 left-0 h-px bg-gold opacity-0 transition-auren',
                      active && 'opacity-100',
                    )}
                  />
                </Link>
              )}

              {hasPanel ? (
                <div
                  id={panelId}
                  hidden={!open}
                  className="absolute inset-x-0 top-full border-y border-line bg-page text-fg shadow-float data-[open=true]:animate-fade-in"
                  data-open={open}
                >
                  <div className="container-page grid grid-cols-12 gap-x-10 py-10">
                    <div className="col-span-8 grid grid-cols-3 gap-x-8">
                      {item.columns!.map((column) => (
                        <div key={column.heading}>
                          <p className="mb-4 type-eyebrow text-fg-muted">{column.heading}</p>
                          <ul className="flex flex-col">
                            {column.links.map((link) => (
                              <li key={`${column.heading}-${link.label}`}>
                                <Link
                                  href={link.href}
                                  onClick={() => onOpenChange(null)}
                                  className="inline-flex min-h-10 items-center type-h3 font-display font-normal text-fg transition-auren-fast hover:text-accent-text"
                                >
                                  {link.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    {item.tile ? (
                      <Link
                        href={item.tile.href}
                        onClick={() => onOpenChange(null)}
                        className="group col-span-4 grid grid-cols-[minmax(0,10rem)_1fr] items-end gap-5"
                      >
                        <span className="relative block aspect-4/5 overflow-hidden bg-sunken">
                          <Image
                            src={item.tile.image}
                            alt={item.tile.imageAlt}
                            fill
                            sizes="160px"
                            className="img-zoom object-cover"
                          />
                        </span>
                        <span className="pb-1">
                          <span className="block type-eyebrow text-accent-text">
                            {item.tile.eyebrow}
                          </span>
                          <span className="mt-2 block type-h2 text-fg">{item.tile.title}</span>
                          <span className="mt-4 inline-block border-b border-gold pb-1 type-eyebrow text-fg">
                            Explore
                          </span>
                        </span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
