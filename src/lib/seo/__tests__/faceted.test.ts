import { describe, expect, it } from 'vitest';
import { getFacetedRobotsAndCanonical } from '../faceted';

const ORIGIN = 'https://auren.example';

describe('14.4 Faceted Navigation SEO Rules', () => {
  it('allows indexing and self-canonical for clean category landing pages', () => {
    const res = getFacetedRobotsAndCanonical('/shop/shirts', undefined, ORIGIN);
    expect(res.canonicalUrl).toBe('https://auren.example/shop/shirts');
    expect(res.robots).toEqual({ index: true, follow: true });
  });

  it('canonicalizes to root and disallows indexing when facet filters are applied', () => {
    const res = getFacetedRobotsAndCanonical(
      '/shop/shirts',
      { color: 'white', size: '40' },
      ORIGIN,
    );
    expect(res.canonicalUrl).toBe('https://auren.example/shop/shirts');
    expect(res.robots).toEqual({ index: false, follow: true });
  });

  it('canonicalizes to root and disallows indexing on deep pagination pages', () => {
    const res = getFacetedRobotsAndCanonical('/shop', { page: '3' }, ORIGIN);
    expect(res.canonicalUrl).toBe('https://auren.example/shop');
    expect(res.robots).toEqual({ index: false, follow: true });
  });

  it('keeps internal search queries unindexed', () => {
    const res = getFacetedRobotsAndCanonical('/search', { q: 'linen' }, ORIGIN);
    expect(res.canonicalUrl).toBe('https://auren.example/search');
    expect(res.robots).toEqual({ index: false, follow: true });
  });
});
