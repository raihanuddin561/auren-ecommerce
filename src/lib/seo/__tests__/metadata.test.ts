import { describe, expect, it } from 'vitest';
import { buildPageMetadata, sanitizeTitle } from '../metadata';

describe('14.1 SEO Metadata Framework', () => {
  it('sanitizes duplicate brand suffixes from page titles', () => {
    expect(sanitizeTitle('Shirts | AUREN')).toBe('Shirts');
    expect(sanitizeTitle('Fine Tailoring | auren')).toBe('Fine Tailoring');
    expect(sanitizeTitle('Linen Collection')).toBe('Linen Collection');
    expect(sanitizeTitle()).toBe('AUREN | Quintessential Menswear Atelier');
  });

  it('builds canonical URLs, title templates and Open Graph cards', () => {
    const meta = buildPageMetadata({
      title: 'Our Story & Atelier',
      description: 'Crafted in Dhaka with pure natural fibers.',
      path: '/about',
    });

    expect(meta.title).toBe('Our Story & Atelier');
    expect(meta.description).toBe('Crafted in Dhaka with pure natural fibers.');
    expect(meta.alternates?.canonical).toBe('http://localhost:3000/about');
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph?.title).toBe('Our Story & Atelier');
    expect(meta.openGraph?.siteName).toBe('AUREN');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('sets noindex for internal search or filtered parameter states', () => {
    const meta = buildPageMetadata({
      title: 'Search Results',
      path: '/search',
      noIndex: true,
    });

    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});
