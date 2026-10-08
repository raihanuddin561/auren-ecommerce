import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HERO_CAROUSEL_SETTINGS,
  DEFAULT_HERO_SLIDES,
  heroCarouselSettingsSchema,
  heroSlideSchema,
} from '../schemas';

describe('hero carousel schemas and settings', () => {
  it('validates default hero slides', () => {
    expect(DEFAULT_HERO_SLIDES.length).toBeGreaterThan(0);
    for (const slide of DEFAULT_HERO_SLIDES) {
      const parsed = heroSlideSchema.safeParse(slide);
      expect(parsed.success).toBe(true);
    }
  });

  it('validates default carousel settings', () => {
    const parsed = heroCarouselSettingsSchema.safeParse(DEFAULT_HERO_CAROUSEL_SETTINGS);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.autoplay).toBe(true);
      expect(parsed.data.autoplayInterval).toBe(6000);
      expect(parsed.data.slides.length).toBe(3);
    }
  });

  it('requires a slide title and image URL', () => {
    const invalid = {
      id: 'test-1',
      title: '',
      imageUrl: '',
    };
    const parsed = heroSlideSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('enforces overlay opacity boundaries (0-90)', () => {
    const slide = {
      id: 'test-1',
      title: 'Valid Title',
      imageUrl: '/seed/charcoal.svg',
      overlayOpacity: 100, // over 90 max
    };
    const parsed = heroSlideSchema.safeParse(slide);
    expect(parsed.success).toBe(false);

    const validSlide = {
      ...slide,
      overlayOpacity: 40,
    };
    const validParsed = heroSlideSchema.safeParse(validSlide);
    expect(validParsed.success).toBe(true);
  });

  it('validates custom carousel configuration with custom autoplay timing', () => {
    const custom = {
      autoplay: false,
      autoplayInterval: 8000,
      slides: [
        {
          id: 'slide-custom',
          eyebrow: 'EXCLUSIVE',
          title: 'Spring Summer Collection',
          description: 'A brand new edit in linen and breathable weaves.',
          primaryCtaText: 'Discover',
          primaryCtaLink: '/collections/summer',
          secondaryCtaText: '',
          secondaryCtaLink: '',
          imageUrl: '/seed/sand.svg',
          imageAlt: 'Summer linen edit',
          overlayOpacity: 30,
          textAlignment: 'center',
          active: true,
          sortOrder: 0,
        },
      ],
    };
    const parsed = heroCarouselSettingsSchema.safeParse(custom);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slides[0]?.textAlignment).toBe('center');
      expect(parsed.data.slides[0]?.imageFit).toBe('contain');
      expect(parsed.data.autoplay).toBe(false);
    }
  });

  it('supports imageFit option and defaults to contain', () => {
    const slide = {
      id: 'fit-test',
      title: 'Minimal Piece',
      imageUrl: '/images/product.jpg',
    };
    const parsed = heroSlideSchema.safeParse(slide);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.imageFit).toBe('contain');
    }

    const coverSlide = {
      ...slide,
      imageFit: 'cover',
    };
    const coverParsed = heroSlideSchema.safeParse(coverSlide);
    expect(coverParsed.success).toBe(true);
    if (coverParsed.success) {
      expect(coverParsed.data.imageFit).toBe('cover');
    }
  });
});
