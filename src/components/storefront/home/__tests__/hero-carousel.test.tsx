import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HERO_CAROUSEL_SETTINGS } from '@/modules/settings/schemas';
import { HeroCarousel, HeroCarouselSkeleton } from '../hero-carousel';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('HeroCarousel', () => {
  it('renders with ARIA carousel role and default slides', () => {
    const markup = html(<HeroCarousel settings={DEFAULT_HERO_CAROUSEL_SETTINGS} />);
    expect(markup).toContain('aria-roledescription="carousel"');
    expect(markup).toContain('Modern, refined menswear');
    expect(markup).toContain('href="/shop"');
    expect(markup).toContain('Explore the collection');
    expect(markup).toContain('role="tablist"');
  });

  it('renders skeleton correctly', () => {
    const markup = html(<HeroCarouselSkeleton />);
    expect(markup).toContain('data-tone="ink"');
    expect(markup).toContain('animate-pulse');
  });

  it('renders empty when slides array is empty', () => {
    const markup = html(
      <HeroCarousel settings={{ autoplay: true, autoplayInterval: 5000, slides: [] }} />,
    );
    expect(markup).toBe('');
  });
});
