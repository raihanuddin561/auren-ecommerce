'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import { CatalogImage, ImagePlaceholder, safeColor } from '../catalog/catalog-image';

/** What is remembered about a viewed product: enough to draw a small card, nothing personal. */
export interface ViewedProduct {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  imageAlt: string | null;
  dominantColor: string | null;
}

const STORAGE_KEY = 'auren:recently-viewed:v1';
const CHANGE_EVENT = 'auren:recently-viewed-change';
const MAX_ITEMS = 12;
const EMPTY: readonly ViewedProduct[] = [];

let cachedRaw: string | null | undefined;
let cached: readonly ViewedProduct[] = EMPTY;

const isViewed = (value: unknown): value is ViewedProduct => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.slug === 'string' &&
    /^[a-z0-9-]+$/.test(v.slug) &&
    typeof v.title === 'string' &&
    (v.imageUrl === null ||
      (typeof v.imageUrl === 'string' &&
        v.imageUrl.startsWith('/') &&
        !v.imageUrl.startsWith('//')))
  );
};

export function readViewed(): readonly ViewedProduct[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed) ? parsed.filter(isViewed).slice(0, MAX_ITEMS) : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

/** Puts a product first in the list (most recent), without duplicates, capped at 12. */
export function withViewed(
  list: readonly ViewedProduct[],
  product: ViewedProduct,
): ViewedProduct[] {
  return [product, ...list.filter((entry) => entry.id !== product.id)].slice(0, MAX_ITEMS);
}

function remember(product: ViewedProduct): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(withViewed(readViewed(), product)));
  } catch {
    // Storage can be blocked (private windows); the rail then just stays empty.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

interface RecentlyViewedProps {
  /** The product on this page: recorded, and left out of the rail. */
  current: ViewedProduct;
  className?: string;
}

/**
 * "Recently viewed": kept in this browser only (localStorage), so it needs no account and nothing
 * leaves the device. Shown on the product page and, later, in the cart.
 */
export function RecentlyViewed({ current, className }: RecentlyViewedProps) {
  const list = useSyncExternalStore(subscribe, readViewed, () => EMPTY);

  useEffect(() => {
    remember(current);
    // current is a fresh object each render; its id is what identifies the visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  const others = list.filter((entry) => entry.id !== current.id).slice(0, 6);
  if (others.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed" className={cn('container-page py-16', className)}>
      <h2 id="recently-viewed" className="mb-6 type-eyebrow text-fg">
        Recently viewed
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {others.map((entry) => (
          <li key={entry.id}>
            <Link href={`/products/${entry.slug}`} className="group block">
              <span
                className="relative block aspect-[4/5] overflow-hidden bg-sunken"
                style={{ backgroundColor: safeColor(entry.dominantColor) }}
              >
                {entry.imageUrl ? (
                  <CatalogImage
                    src={entry.imageUrl}
                    alt=""
                    sizes="(min-width: 1024px) 16vw, 33vw"
                  />
                ) : (
                  <ImagePlaceholder label={entry.title} />
                )}
              </span>
              <span className="mt-2 block type-small text-fg group-hover:underline">
                {entry.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
