import { describe, expect, it } from 'vitest';
import {
  articleSlugSchema,
  createArticleSchema,
  updateArticleSchema,
  articleFilterSchema,
} from '../schemas';

describe('Journal Schemas', () => {
  describe('articleSlugSchema', () => {
    it('accepts clean lowercase hyphenated slugs', () => {
      expect(articleSlugSchema.safeParse('the-anatomy-of-noble-linen').success).toBe(true);
      expect(articleSlugSchema.safeParse('craft-2026').success).toBe(true);
    });

    it('rejects invalid slug characters', () => {
      expect(articleSlugSchema.safeParse('The-Linen').success).toBe(false);
      expect(articleSlugSchema.safeParse('noble_linen').success).toBe(false);
      expect(articleSlugSchema.safeParse('linen--study').success).toBe(false);
    });
  });

  describe('createArticleSchema', () => {
    it('validates a complete article input', () => {
      const valid = {
        title: 'The Anatomy of Noble Linen: Why Natural Fibers Breathe in Dhaka',
        slug: 'the-anatomy-of-noble-linen',
        excerpt:
          'A textile study into genuine Irish flax, flaxen cellular mechanics, and why noble linen softens with age rather than degrades.',
        content:
          '# The Anatomy of Noble Linen\n\nThere is a profound distinction between synthetic technical fabrics and natural cellulose spun from pure European flax.',
        heroImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf',
        heroImageAlt: 'Pure unbleached Irish flax yarns',
        category: 'Fabric Studies',
        tags: ['Linen', 'Noble Fibers', 'Craftsmanship'],
        authorName: 'Auren Atelier',
        status: 'published',
        readTimeMinutes: 4,
        seoTitle: 'The Anatomy of Noble Linen | AUREN Journal',
        seoDescription: 'Textile study into Irish flax mechanics and drape.',
        featuredProductIds: ['019277d3-b8d4-72fb-9ef6-e7e0e7a2b001'],
      };

      const result = createArticleSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects short excerpt or empty content', () => {
      const invalid = {
        title: 'Too short',
        slug: 'too-short',
        excerpt: 'Short',
        content: 'Brief',
        heroImage: 'https://example.com/hero.jpg',
      };

      const result = createArticleSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('updateArticleSchema', () => {
    it('validates partial update with valid uuid', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Updated Editorial Note on Linen',
        status: 'published',
      };
      const result = updateArticleSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid uuid', () => {
      const invalid = {
        id: 'not-a-uuid',
        title: 'Valid Title',
      };
      const result = updateArticleSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('articleFilterSchema', () => {
    it('defaults pagination and all status', () => {
      const result = articleFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(12);
        expect(result.data.status).toBe('all');
      }
    });

    it('accepts category filter and custom page', () => {
      const result = articleFilterSchema.safeParse({
        category: 'Craft & Atelier',
        page: 2,
        pageSize: 6,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('Craft & Atelier');
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(6);
      }
    });
  });
});
