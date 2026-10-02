'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { useReducedMotion } from '@/components/motion/use-reduced-motion';

const MAX_MESSAGES = 3;
const ROTATE_EVERY_MS = 7000;

interface AnnouncementBarProps {
  messages: string[];
}

const controlClass =
  'inline-flex size-11 items-center justify-center text-fg transition-auren-fast hover:text-accent-text';

/**
 * Up to three short messages. Rotation is slow, pauses on hover and focus, stops for visitors who
 * prefer reduced motion, and can be paused or stepped manually.
 */
export function AnnouncementBar({ messages }: AnnouncementBarProps) {
  const items = messages.slice(0, MAX_MESSAGES);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const reduced = useReducedMotion();

  const rotating = items.length > 1 && !paused && !engaged && !reduced;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % items.length),
      ROTATE_EVERY_MS,
    );
    return () => window.clearInterval(timer);
  }, [rotating, items.length]);

  if (items.length === 0) return null;
  const step = (delta: number) =>
    setIndex((current) => (current + delta + items.length) % items.length);

  return (
    <section
      aria-label="Announcements"
      data-tone="ink"
      className="bg-page text-fg"
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
    >
      <div className="container-page flex min-h-11 items-center justify-between gap-1 md:gap-4">
        <span className="hidden w-24 md:block" aria-hidden="true" />
        <p
          aria-live={rotating ? 'off' : 'polite'}
          className="min-w-0 flex-1 text-center type-eyebrow text-balance"
        >
          {items[index]}
        </p>
        <div className="flex shrink-0 items-center justify-end gap-1 md:w-24">
          {items.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous announcement"
                onClick={() => step(-1)}
                className={`${controlClass} hidden md:inline-flex`}
              >
                <Icon icon={ChevronLeft} size={16} />
              </button>
              <button
                type="button"
                aria-label={paused ? 'Resume announcements' : 'Pause announcements'}
                aria-pressed={paused}
                onClick={() => setPaused((value) => !value)}
                className={controlClass}
              >
                <Icon icon={paused ? Play : Pause} size={14} />
              </button>
              <button
                type="button"
                aria-label="Next announcement"
                onClick={() => step(1)}
                className={`${controlClass} hidden md:inline-flex`}
              >
                <Icon icon={ChevronRight} size={16} />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
