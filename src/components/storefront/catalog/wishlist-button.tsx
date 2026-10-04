'use client';

import { Heart } from 'lucide-react';
import { useCallback, useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icon';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

/**
 * Stand-in for the wishlist until accounts exist: product ids are kept in this browser only
 * (localStorage), so the heart works for visitors but is not shared across devices.
 */
const STORAGE_KEY = 'auren:wishlist:v1';
const CHANGE_EVENT = 'auren:wishlist-change';
const MAX_ITEMS = 200;

const EMPTY: readonly string[] = [];
let cachedRaw: string | null | undefined;
let cachedIds: readonly string[] = EMPTY;

function readIds(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedIds;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedIds = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_ITEMS)
      : EMPTY;
  } catch {
    cachedIds = EMPTY;
  }
  return cachedIds;
}

function writeIds(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be blocked (private windows); the heart then simply does not persist.
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

interface WishlistButtonProps {
  productId: string;
  title: string;
  className?: string;
}

export function WishlistButton({ productId, title, className }: WishlistButtonProps) {
  const ids = useSyncExternalStore(subscribe, readIds, () => EMPTY);
  const saved = ids.includes(productId);

  const toggle = useCallback(() => {
    const current = readIds();
    if (current.includes(productId)) {
      writeIds(current.filter((id) => id !== productId));
    } else {
      writeIds([productId, ...current].slice(0, MAX_ITEMS));
      toast.message('Saved to your wishlist', 'Kept on this device until you sign in.');
    }
  }, [productId]);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
      onClick={toggle}
      className={cn(
        'touch-target relative z-20 inline-flex size-11 items-center justify-center bg-page/80 text-fg transition-auren-fast hover:bg-page',
        className,
      )}
    >
      <Icon icon={Heart} size={20} className={cn(saved && 'fill-current')} />
    </button>
  );
}
