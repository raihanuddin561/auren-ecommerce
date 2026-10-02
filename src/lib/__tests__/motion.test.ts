import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOTION,
  prefersReducedMotion,
  runViewTransition,
  shouldDeferReveal,
  viewTransitionName,
} from '../motion';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('motion tokens', () => {
  it('match the design system durations and easing', () => {
    expect(MOTION).toMatchObject({ fast: 150, base: 250, slow: 450, reveal: 800 });
    expect(MOTION.ease).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
  });
});

describe('prefersReducedMotion', () => {
  it('is false on the server', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('follows the media query in the browser', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('shouldDeferReveal', () => {
  const base = { viewportHeight: 800, reducedMotion: false, hasObserver: true };

  it('hides elements below the fold', () => {
    expect(shouldDeferReveal({ ...base, top: 1200 })).toBe(true);
  });

  it('leaves elements that are already on screen visible', () => {
    expect(shouldDeferReveal({ ...base, top: 100 })).toBe(false);
    expect(shouldDeferReveal({ ...base, top: -300 })).toBe(false);
  });

  it('never hides content for reduced motion or without IntersectionObserver', () => {
    expect(shouldDeferReveal({ ...base, top: 1200, reducedMotion: true })).toBe(false);
    expect(shouldDeferReveal({ ...base, top: 1200, hasObserver: false })).toBe(false);
  });
});

describe('viewTransitionName', () => {
  it('builds a valid CSS identifier', () => {
    expect(viewTransitionName('image', 'abc-123')).toBe('image-abc-123');
    expect(viewTransitionName('image', 'A B/C')).toBe('image-a-b-c');
  });

  it('never starts with a digit', () => {
    expect(viewTransitionName('1', '2')).toBe('t-1-2');
  });
});

describe('runViewTransition', () => {
  it('just runs the update when the API is missing', () => {
    vi.stubGlobal('document', {});
    const update = vi.fn();
    runViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('wraps the update in a view transition when supported', () => {
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    vi.stubGlobal('document', { startViewTransition });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const update = vi.fn();
    runViewTransition(update);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('skips the animation for reduced motion but still updates', () => {
    const startViewTransition = vi.fn();
    vi.stubGlobal('document', { startViewTransition });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const update = vi.fn();
    runViewTransition(update);
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
