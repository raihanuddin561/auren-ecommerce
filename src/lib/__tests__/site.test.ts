import { describe, expect, it } from 'vitest';
import {
  ANNOUNCEMENTS,
  conciergeHref,
  FOOTER_COLUMNS,
  hasHeroHeader,
  hidesConcierge,
  PRIMARY_NAV,
} from '../site';
import { isValidEmail } from '@/components/storefront/newsletter-form';

describe('storefront chrome content', () => {
  it('keeps announcements short and calm: at most three, no exclamation marks', () => {
    expect(ANNOUNCEMENTS.length).toBeLessThanOrEqual(3);
    for (const message of ANNOUNCEMENTS) {
      expect(message).not.toContain('!');
      expect(message).not.toMatch(/hurry|last chance|act now/i);
    }
  });

  it('has the primary destinations in order', () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual(['Shop', 'New', 'Collections']);
  });

  it('gives every mega menu panel at least one column and every link a path', () => {
    for (const item of PRIMARY_NAV) {
      expect(item.href.startsWith('/')).toBe(true);
      for (const column of item.columns ?? []) {
        expect(column.links.length).toBeGreaterThan(0);
        for (const link of column.links) expect(link.href.startsWith('/')).toBe(true);
      }
      if (item.tile) expect(item.tile.imageAlt.length).toBeGreaterThan(0);
    }
  });

  it('has footer columns with unique headings', () => {
    const headings = FOOTER_COLUMNS.map((column) => column.heading);
    expect(new Set(headings).size).toBe(headings.length);
  });
});

describe('conciergeHref', () => {
  it('opens WhatsApp with the digits of a configured number', () => {
    const href = conciergeHref('+880 1700-000000');
    expect(href.startsWith('https://wa.me/8801700000000?text=')).toBe(true);
  });

  it('falls back to the contact page without a usable number', () => {
    expect(conciergeHref(undefined)).toBe('/contact');
    expect(conciergeHref('')).toBe('/contact');
    expect(conciergeHref('12')).toBe('/contact');
  });
});

describe('page rules for the shell', () => {
  it('hides the concierge on checkout only', () => {
    expect(hidesConcierge('/checkout')).toBe(true);
    expect(hidesConcierge('/checkout/payment')).toBe(true);
    expect(hidesConcierge('/checkout-guide')).toBe(false);
    expect(hidesConcierge('/')).toBe(false);
    expect(hidesConcierge('/shop')).toBe(false);
  });

  it('starts transparent only where a hero sits under the header', () => {
    expect(hasHeroHeader('/')).toBe(true);
    expect(hasHeroHeader('/shop')).toBe(false);
  });
});

describe('newsletter email check', () => {
  it('accepts ordinary addresses and rejects obvious mistakes', () => {
    expect(isValidEmail('ayaan@example.com')).toBe(true);
    expect(isValidEmail('  ayaan@example.com ')).toBe(true);
    expect(isValidEmail('ayaan@example')).toBe(false);
    expect(isValidEmail('ayaan example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});
