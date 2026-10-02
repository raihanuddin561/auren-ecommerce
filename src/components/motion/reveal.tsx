'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { prefersReducedMotion, shouldDeferReveal } from '@/lib/motion';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger siblings by passing 0, 100, 200 (milliseconds). */
  delay?: number;
  /** Rise distance in pixels (8 to 16 is the brand range). */
  distance?: number;
  as?: 'div' | 'section' | 'article' | 'li' | 'p' | 'header' | 'footer';
}

/**
 * Fade and rise once when the element first scrolls into view. Content is visible without
 * JavaScript, on screen at load, and for visitors who prefer reduced motion; only elements still
 * below the fold are hidden after hydration, so there is no flash and no layout shift.
 */
export function Reveal({ children, className, delay = 0, distance = 12, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const defer = shouldDeferReveal({
      top: element.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
      reducedMotion: prefersReducedMotion(),
      hasObserver: 'IntersectionObserver' in window,
    });
    if (!defer) return;

    element.dataset.reveal = 'hidden';
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        element.dataset.reveal = 'shown';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  const style = {
    '--reveal-delay': `${delay}ms`,
    '--reveal-distance': `${distance}px`,
  } as CSSProperties;

  return (
    <Tag ref={ref as never} className={cn('reveal', className)} style={style}>
      {children}
    </Tag>
  );
}
