/**
 * Motion helpers shared by client components. Pure and SSR-safe: every browser API is guarded so
 * these can be imported anywhere and unit-tested in Node.
 */

export const MOTION = {
  fast: 150,
  base: 250,
  slow: 450,
  reveal: 800,
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface RevealInput {
  /** Top edge of the element relative to the viewport. */
  top: number;
  viewportHeight: number;
  reducedMotion: boolean;
  hasObserver: boolean;
}

/**
 * Whether an element should be hidden until it scrolls into view. Elements already on screen,
 * users who prefer reduced motion, and browsers without IntersectionObserver always see content.
 */
export function shouldDeferReveal({
  top,
  viewportHeight,
  reducedMotion,
  hasObserver,
}: RevealInput): boolean {
  if (reducedMotion || !hasObserver) return false;
  return top >= viewportHeight * 0.95;
}

/** Name for a shared element across views, for example a product card image to the PDP gallery. */
export function viewTransitionName(kind: string, id: string): string {
  const safe = `${kind}-${id}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  // CSS identifiers cannot start with a digit.
  return /^[a-z_]/.test(safe) ? safe : `t-${safe}`;
}

type DocumentWithTransitions = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> };
};

/**
 * Runs a navigation or state update inside the View Transitions API when the browser supports it
 * and the user has not asked for reduced motion. Otherwise it just runs the update.
 */
export function runViewTransition(update: () => void | Promise<void>): void {
  const doc = typeof document === 'undefined' ? undefined : (document as DocumentWithTransitions);
  if (!doc || typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    void update();
    return;
  }
  doc.startViewTransition(update);
}
