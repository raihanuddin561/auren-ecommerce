'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/action-result';
import { cn } from '@/lib/cn';
import { gridColumnClasses, type Density } from '@/modules/catalog/listing';
import { ProductCard, type ProductCardView } from './product-card';

export type ListingScopeInput =
  { kind: 'shop'; path: string } | { kind: 'collection'; slug: string };

interface LoadMoreProps {
  /** The server action that returns the next page (passed in so this file stays decoupled). */
  loadMore: (
    input: unknown,
  ) => Promise<ActionResult<{ cards: ProductCardView[]; hasMore: boolean }>>;
  scope: ListingScopeInput;
  /** Query string of the page without `page`. */
  search: string;
  /** The page the server rendered. */
  page: number;
  hasMore: boolean;
  /** Pieces on the server-rendered page, and in all, for the progress line. */
  shown: number;
  total: number;
  density: Density | null;
  sizes: string;
  /** Crawlable page links, rendered on the server. They stay even when this button works. */
  pagination: ReactNode;
}

interface SavedState {
  pages: Array<{ page: number; cards: ProductCardView[] }>;
  scrollY: number;
  leftViaLink: boolean;
  savedAt: number;
}

const RESTORE_WINDOW_MS = 15 * 60 * 1000;

const subscribeNever = () => () => undefined;
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

function readSaved(key: string): SavedState | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    return Date.now() - parsed.savedAt < RESTORE_WINDOW_MS ? parsed : null;
  } catch {
    return null;
  }
}

function writeSaved(key: string, state: SavedState): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage is a convenience; without it the list simply starts again on the first page.
  }
}

/**
 * "Load more" on top of real page links. Without JavaScript (and for search engines) the numbered
 * pagination below works as ordinary links; with JavaScript the button appends the next page to the
 * list. Appended pages and the scroll position are kept for the back button, so returning from a
 * product lands where the visitor left.
 */
export function LoadMore({
  loadMore,
  scope,
  search,
  page,
  hasMore: initialHasMore,
  shown,
  total,
  density,
  sizes,
  pagination,
}: LoadMoreProps) {
  const hydrated = useHydrated();
  const storageKey = `auren:listing:${scope.kind}:${scope.kind === 'shop' ? scope.path : scope.slug}?${search}#${page}`;
  const [pages, setPages] = useState<SavedState['pages']>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = useRef({ pages, storageKey });
  useEffect(() => {
    latest.current = { pages, storageKey };
  });

  // Coming back from a product: put the appended pages and the scroll position back.
  useEffect(() => {
    const saved = readSaved(storageKey);
    if (!saved?.leftViaLink) return;
    writeSaved(storageKey, { ...saved, leftViaLink: false });
    const frame = window.requestAnimationFrame(() => {
      setPages(saved.pages);
      const last = saved.pages.at(-1);
      if (last) setHasMore(true);
      window.requestAnimationFrame(() => window.scrollTo({ top: saved.scrollY }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  // Remember the list when the visitor follows a link out of it.
  useEffect(() => {
    const remember = () => {
      const { pages: current, storageKey: key } = latest.current;
      writeSaved(key, {
        pages: current,
        scrollY: window.scrollY,
        leftViaLink: true,
        savedAt: Date.now(),
      });
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest('a[href]')) remember();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const nextPage = (pages.at(-1)?.page ?? page) + 1;

  const fetchNext = () => {
    setError(null);
    startTransition(async () => {
      const result = await loadMore({ scope, search, page: nextPage });
      if (!result.ok) {
        setError(
          result.error.code === 'RATE_LIMITED'
            ? 'Please wait a moment and try again.'
            : 'We could not load more pieces. Please try again.',
        );
        return;
      }
      setPages((current) => [...current, { page: nextPage, cards: result.data.cards }]);
      setHasMore(result.data.hasMore);
    });
  };

  const visible = shown + pages.reduce((n, entry) => n + entry.cards.length, 0);

  return (
    <div>
      {pages.map((entry) => (
        <ul
          key={entry.page}
          aria-label={`Products, page ${entry.page}`}
          className={cn(
            'mt-10 grid gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-14',
            gridColumnClasses(density),
          )}
        >
          {entry.cards.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} sizes={sizes} />
            </li>
          ))}
        </ul>
      ))}

      <div className="mt-14 flex flex-col items-center gap-4">
        <p role="status" className="type-small text-fg-muted tabular-nums">
          Showing {Math.min(visible, total)} of {total} pieces
        </p>
        {hydrated && hasMore ? (
          <Button type="button" variant="secondary" size="lg" onClick={fetchNext} loading={pending}>
            Load more
          </Button>
        ) : null}
        {error ? (
          <p role="alert" className="type-small text-danger-text">
            {error}
          </p>
        ) : null}
      </div>
      <div className="mt-8">{pagination}</div>
    </div>
  );
}
