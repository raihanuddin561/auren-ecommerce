import { describe, expect, it } from 'vitest';
import {
  createPageSchema,
  createPageSectionSchema,
  heroBannerBlockSchema,
  editorialQuoteBlockSchema,
  brandPerksBlockSchema,
  newsletterStripBlockSchema,
  richTextBlockSchema,
  faqAccordionBlockSchema,
  splitBannerBlockSchema,
  validateBlockProps,
} from '../schemas';

describe('Content module validation schemas', () => {
  describe('createPageSchema', () => {
    it('validates a correct page input', () => {
      const res = createPageSchema.safeParse({
        title: 'The Sartorial Atelier',
        slug: 'sartorial-atelier',
        description: 'Inside the Banani suiting workshop.',
        status: 'published',
      });
      expect(res.success).toBe(true);
    });

    it('rejects invalid slugs with uppercase or special characters', () => {
      const res = createPageSchema.safeParse({
        title: 'Atelier Page',
        slug: 'Sartorial_Atelier!',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.path).toContain('slug');
      }
    });

    it('rejects empty title', () => {
      const res = createPageSchema.safeParse({
        title: '   ',
        slug: 'valid-slug',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('heroBannerBlockSchema', () => {
    it('accepts valid hero banner props', () => {
      const res = heroBannerBlockSchema.safeParse({
        headline: 'The Art of Slow Luxury',
        subtitle: 'Crafted from pure Italian cashmere and French linen.',
        ctaLabel: 'Discover Collection',
        ctaUrl: '/shop',
        theme: 'ink',
        overlayOpacity: 40,
      });
      expect(res.success).toBe(true);
    });

    it('rejects missing headline', () => {
      const res = heroBannerBlockSchema.safeParse({
        headline: '',
        ctaLabel: 'Shop',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('editorialQuoteBlockSchema', () => {
    it('validates editorial quotes', () => {
      const res = editorialQuoteBlockSchema.safeParse({
        quote: 'Elegance is refusal. True bespoke tailoring needs no embellishment.',
        author: 'Master Tailor',
        title: 'Auren Sartorial Atelier',
      });
      expect(res.success).toBe(true);
    });

    it('rejects quote that is too short', () => {
      const res = editorialQuoteBlockSchema.safeParse({
        quote: 'Hi',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('brandPerksBlockSchema', () => {
    it('validates brand perks pillars', () => {
      const res = brandPerksBlockSchema.safeParse({
        headline: 'Atelier Standards',
        items: [
          { icon: 'Sparkles', title: 'Noble Fibers', description: 'Certified Giza cotton' },
          { icon: 'Scissors', title: 'Hand Finished', description: 'Pick stitching on lapels' },
        ],
      });
      expect(res.success).toBe(true);
    });

    it('rejects perks when items array is empty', () => {
      const res = brandPerksBlockSchema.safeParse({
        items: [],
      });
      expect(res.success).toBe(false);
    });
  });

  describe('createPageSectionSchema', () => {
    it('validates section creation with valid block props', () => {
      const res = createPageSectionSchema.safeParse({
        pageId: '123e4567-e89b-12d3-a456-426614174000',
        blockType: 'newsletter_strip',
        sortOrder: 1,
        props: {
          headline: 'Private Atelier Access',
          buttonLabel: 'Request Invitation',
        },
      });
      expect(res.success).toBe(true);
    });
  });

  describe('newsletterStripBlockSchema', () => {
    it('validates newsletter strip props', () => {
      const res = newsletterStripBlockSchema.safeParse({
        headline: 'Join The Private Atelier',
        buttonLabel: 'Request Invitation',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('richTextBlockSchema', () => {
    it('validates rich text content', () => {
      const res = richTextBlockSchema.safeParse({
        headline: 'Our Craft Legacy',
        content: 'From the mills of Biella to the atelier cutting tables.',
        alignment: 'center',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('faqAccordionBlockSchema', () => {
    it('validates faq accordion questions and answers', () => {
      const res = faqAccordionBlockSchema.safeParse({
        headline: 'Frequently Asked Questions',
        items: [
          {
            question: 'What is the lead time for bespoke garments?',
            answer: 'Between 3 to 4 weeks.',
          },
        ],
      });
      expect(res.success).toBe(true);
    });
  });

  describe('splitBannerBlockSchema', () => {
    it('validates split banner configuration', () => {
      const res = splitBannerBlockSchema.safeParse({
        headline: 'Dual Heritage',
        description: 'Bespoke precision meeting noble Italian fibers.',
        mediaPosition: 'left',
        mediaUrl: 'https://images.unsplash.com/photo-test',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('validateBlockProps helper', () => {
    it('correctly routes validation per block type', () => {
      const validHero = validateBlockProps('hero_banner', {
        headline: 'Signature Hero',
        ctaLabel: 'Shop Now',
      });
      expect(validHero.success).toBe(true);

      const invalidQuote = validateBlockProps('editorial_quote', {
        quote: '',
      });
      expect(invalidQuote.success).toBe(false);
    });
  });

  describe('createPageFromTemplateSchema and LANDING_PAGE_TEMPLATES', () => {
    it('validates template creation schema', async () => {
      const { createPageFromTemplateSchema } = await import('../schemas');
      const res = createPageFromTemplateSchema.safeParse({
        templateId: 'seasonal_capsule',
        title: 'Winter Capsule 2026',
        slug: 'winter-capsule-2026',
        description: 'Limited seasonal drop.',
        status: 'draft',
      });
      expect(res.success).toBe(true);
    });

    it('all registered landing page starter templates pass block validation', async () => {
      const { LANDING_PAGE_TEMPLATES } = await import('../templates');
      expect(LANDING_PAGE_TEMPLATES.length).toBeGreaterThanOrEqual(4);

      for (const template of LANDING_PAGE_TEMPLATES) {
        expect(template.id).toBeTruthy();
        expect(template.title).toBeTruthy();
        expect(template.sections.length).toBeGreaterThan(0);

        for (const section of template.sections) {
          const val = validateBlockProps(section.blockType, section.props);
          expect(
            val.success,
            `Template ${template.id} section ${section.name} failed validation`,
          ).toBe(true);
        }
      }
    });
  });
});
