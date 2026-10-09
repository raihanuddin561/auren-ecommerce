import { describe, expect, it } from 'vitest';
import {
  articleJsonLd,
  faqPageJsonLd,
  merchantReturnPolicyNode,
  offerShippingDetailsNodes,
  organizationJsonLd,
  websiteJsonLd,
} from '../jsonld';

const ORIGIN = 'https://auren.example';

describe('14.2 Rich Structured Data (JSON-LD)', () => {
  it('builds an Organization schema with Bangladesh headquarters and contact point', () => {
    const org = organizationJsonLd(ORIGIN);
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe('AUREN');
    expect(org.url).toBe(ORIGIN);
    expect(org.address).toMatchObject({
      '@type': 'PostalAddress',
      addressLocality: 'Dhaka',
      postalCode: '1213',
      addressCountry: 'BD',
    });
    expect(org.contactPoint).toMatchObject({
      '@type': 'ContactPoint',
      areaServed: 'BD',
    });
  });

  it('builds a WebSite schema with Sitelinks SearchAction', () => {
    const site = websiteJsonLd(ORIGIN);
    expect(site['@type']).toBe('WebSite');
    expect(site.url).toBe(ORIGIN);
    expect(site.potentialAction).toMatchObject({
      '@type': 'SearchAction',
      target: {
        urlTemplate: 'https://auren.example/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    });
  });

  it('builds MerchantReturnPolicy for Bangladesh 7-day doorstep exchange', () => {
    const policy = merchantReturnPolicyNode();
    expect(policy['@type']).toBe('MerchantReturnPolicy');
    expect(policy.applicableCountry).toBe('BD');
    expect(policy.merchantReturnDays).toBe(7);
    expect(policy.returnFees).toBe('https://schema.org/FreeReturn');
  });

  it('builds OfferShippingDetails for Dhaka (80 BDT) and Nationwide (150 BDT)', () => {
    const rates = offerShippingDetailsNodes();
    expect(rates).toHaveLength(2);
    expect(rates[0]?.shippingRate).toEqual({
      '@type': 'MonetaryAmount',
      value: '80.00',
      currency: 'BDT',
    });
    expect(rates[1]?.shippingRate).toEqual({
      '@type': 'MonetaryAmount',
      value: '150.00',
      currency: 'BDT',
    });
  });

  it('builds FAQPage schema for rich snippet accordions', () => {
    const faq = faqPageJsonLd([
      {
        question: 'What is your delivery timeframe?',
        answer: 'Within Dhaka Metropolitan: 24 to 48 hours for ৳80.',
      },
    ]);
    expect(faq['@type']).toBe('FAQPage');
    expect(faq.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'What is your delivery timeframe?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Within Dhaka Metropolitan: 24 to 48 hours for ৳80.',
        },
      },
    ]);
  });

  it('builds Article schema for editorial lookbook entries', () => {
    const article = articleJsonLd(
      {
        title: 'The Architecture of Linen',
        description: 'Why Belgian flax breathes through humid summers.',
        path: '/journal/architecture-of-linen',
        publishedAt: '2026-06-01T10:00:00Z',
      },
      ORIGIN,
    );
    expect(article['@type']).toBe('Article');
    expect(article.headline).toBe('The Architecture of Linen');
    expect(article.url).toBe('https://auren.example/journal/architecture-of-linen');
  });
});
