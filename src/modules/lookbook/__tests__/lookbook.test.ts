import { describe, expect, it } from 'vitest';
import {
  createLookbookSchema,
  updateLookbookSchema,
  createSlideSchema,
  createHotspotSchema,
  slugSchema,
} from '../schemas';

describe('Lookbook Schemas', () => {
  describe('slugSchema', () => {
    it('accepts clean lowercase hyphenated slugs', () => {
      expect(slugSchema.safeParse('autumn-winter-2026').success).toBe(true);
      expect(slugSchema.safeParse('monochrome-tailoring').success).toBe(true);
      expect(slugSchema.safeParse('aw26').success).toBe(true);
    });

    it('rejects uppercase, spaces, and consecutive hyphens', () => {
      expect(slugSchema.safeParse('Autumn-Winter').success).toBe(false);
      expect(slugSchema.safeParse('autumn winter').success).toBe(false);
      expect(slugSchema.safeParse('autumn--winter').success).toBe(false);
      expect(slugSchema.safeParse('-autumn-').success).toBe(false);
    });
  });

  describe('createLookbookSchema', () => {
    it('validates a complete lookbook input', () => {
      const valid = {
        title: 'Autumn / Winter 2026: Noble Textures',
        slug: 'autumn-winter-2026',
        season: 'AW 2026',
        description: 'Editorial exploration of textured wool and noble fibers.',
        heroImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf',
        heroImageAlt: 'AW 2026 Editorial Curation',
        status: 'published',
        sortOrder: 1,
      };

      const result = createLookbookSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects missing hero image or title', () => {
      const invalid = {
        title: '',
        slug: 'spring-2026',
        season: 'SS 2026',
        heroImage: '',
      };

      const result = createLookbookSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('updateLookbookSchema', () => {
    it('validates partial updates with a valid uuid', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Spring / Summer 2027: Raw Textures',
        status: 'published',
      };
      const result = updateLookbookSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects update without valid uuid', () => {
      const invalid = {
        id: 'bad-id',
        title: 'New Title',
      };
      const result = updateLookbookSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('createSlideSchema', () => {
    it('validates a slide with required fields', () => {
      const valid = {
        lookbookId: '019277d3-b8d4-72fb-9ef6-e7e0e7a2b001',
        imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
        imageAlt: 'Sculptural tailored blazer frame',
        title: 'Frame I',
        caption: 'Double-breasted tailoring cut from Irish linen.',
        sortOrder: 0,
      };

      const result = createSlideSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects slide without image alt text', () => {
      const invalid = {
        lookbookId: '019277d3-b8d4-72fb-9ef6-e7e0e7a2b001',
        imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
        imageAlt: ' ',
      };

      const result = createSlideSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('createHotspotSchema', () => {
    it('validates coordinate boundaries (0 to 100 percentage)', () => {
      const valid = {
        slideId: '019277d3-b8d4-72fb-9ef6-e7e0e7a2b002',
        productId: '019277d3-b8d4-72fb-9ef6-e7e0e7a2b003',
        x: 48.5,
        y: 62.0,
        label: 'Pleated Wool Trouser',
      };

      const result = createHotspotSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects coordinates outside 0-100 range', () => {
      const invalidX = {
        slideId: '019277d3-b8d4-72fb-9ef6-e7e0e7a2b002',
        productId: '019277d3-b8d4-72fb-9ef6-e7e0e7a2b003',
        x: 105.0,
        y: 50.0,
      };

      const result = createHotspotSchema.safeParse(invalidX);
      expect(result.success).toBe(false);

      const invalidY = {
        slideId: '019277d3-b8d4-72fb-9ef6-e7e0e7a2b002',
        productId: '019277d3-b8d4-72fb-9ef6-e7e0e7a2b003',
        x: 50.0,
        y: -5.0,
      };

      const resultY = createHotspotSchema.safeParse(invalidY);
      expect(resultY.success).toBe(false);
    });
  });
});
