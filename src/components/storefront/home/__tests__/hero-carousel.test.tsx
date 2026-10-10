import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HERO_CAROUSEL_SETTINGS } from '@/modules/settings/schemas';
import { HeroCarousel, HeroCarouselSkeleton } from '../hero-carousel';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('HeroCarousel', () => {
  it('renders with ARIA carousel role and default slides', () => {
    const markup = html(<HeroCarousel settings={DEFAULT_HERO_CAROUSEL_SETTINGS} />);
    expect(markup).toContain('aria-roledescription="carousel"');
    expect(markup).toContain('Architectural Cuts in Tropical Wool');
    expect(markup).toContain('href="/shop"');
    expect(markup).toContain('Explore Collection');
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

  it('renders both cover and contain slides inside the uniform 4:5 showcase frame', () => {
    const customSettings = {
      autoplay: true,
      autoplayInterval: 5000,
      slides: [
        {
          id: 'slide-cover',
          eyebrow: 'SPRING EDIT',
          title: 'Tailored Linen Blazer',
          description: 'A breathable silhouette for warm climate luxury.',
          primaryCtaText: 'Shop blazer',
          primaryCtaLink: '/products/linen-blazer',
          secondaryCtaText: '',
          secondaryCtaLink: '',
          imageUrl: '/seed/charcoal.svg',
          imageAlt: 'Linen Blazer Cover Shot',
          overlayOpacity: 25,
          textAlignment: 'left' as const,
          imageFit: 'cover' as const,
          active: true,
          sortOrder: 0,
        },
        {
          id: 'slide-contain',
          eyebrow: 'ARCHIVE PIECE',
          title: 'Silk Evening Shirt',
          description: 'Pure mulberry silk with mother-of-pearl buttons.',
          primaryCtaText: 'Discover shirt',
          primaryCtaLink: '/products/silk-shirt',
          secondaryCtaText: '',
          secondaryCtaLink: '',
          imageUrl: '/seed/sand.svg',
          imageAlt: 'Silk Shirt Contain Shot',
          overlayOpacity: 25,
          textAlignment: 'left' as const,
          imageFit: 'contain' as const,
          active: true,
          sortOrder: 1,
        },
      ],
    };

    const markup = html(<HeroCarousel settings={customSettings} />);
    // Uniform fixed 4:5 showcase frame
    expect(markup).toContain('aspect-[4/5]');
    // Cover slide has object-cover
    expect(markup).toContain('object-cover object-center');
    // Contain slide renders ambient backdrop + centered object-contain
    expect(markup).toContain('object-contain');
    expect(markup).toContain('blur-xl');
    // Atelier badge present
    expect(markup).toContain('Auren Atelier');
  });
});
