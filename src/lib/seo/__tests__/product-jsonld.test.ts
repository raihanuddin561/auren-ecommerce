import { describe, expect, it } from 'vitest';
import { productJsonLd, serializeJsonLd } from '../jsonld';

interface OfferNode {
  '@type': string;
  price?: string;
  priceCurrency?: string;
  availability?: string;
  lowPrice?: string;
  highPrice?: string;
  offerCount?: number;
  offers?: unknown[];
}
interface ProductNode {
  '@type': string;
  url: string;
  image: string[];
  offers?: OfferNode;
}

const base = {
  name: 'Oxford Shirt',
  description: 'Brushed cotton.',
  path: '/products/oxford-shirt',
  images: ['/a.jpg', 'https://cdn.example/b.jpg'],
  category: 'Shirts',
  breadcrumb: [
    { name: 'Shop', path: '/shop' },
    { name: 'Shirts', path: '/shop/shirts' },
    { name: 'Oxford Shirt' },
  ],
};

const offer = (sku: string, price: string, minor: bigint, inStock: boolean) => ({
  sku,
  price,
  priceMinor: minor,
  currency: 'BDT',
  inStock,
});

describe('Product JSON-LD', () => {
  it('a single variant is a plain Offer with an absolute address', () => {
    const data = productJsonLd(
      { ...base, offers: [offer('A', '3290.00', 329000n, true)] },
      'https://auren.test',
    );
    const graph = data['@graph'] as ProductNode[];
    const product = graph[0]!;
    expect(product['@type']).toBe('Product');
    expect(product.url).toBe('https://auren.test/products/oxford-shirt');
    expect(product.image).toEqual(['https://auren.test/a.jpg', 'https://cdn.example/b.jpg']);
    expect(product.offers).toMatchObject({
      '@type': 'Offer',
      price: '3290.00',
      priceCurrency: 'BDT',
      availability: 'https://schema.org/InStock',
    });
    expect(graph[1]?.['@type']).toBe('BreadcrumbList');
  });

  it('several variants become an AggregateOffer with exact low and high prices', () => {
    const data = productJsonLd({
      ...base,
      offers: [
        offer('A', '3490.00', 349000n, false),
        offer('B', '3290.00', 329000n, false),
        offer('C', '3390.50', 339050n, false),
      ],
    });
    const product = (data['@graph'] as ProductNode[])[0]!;
    expect(product.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '3290.00',
      highPrice: '3490.00',
      offerCount: 3,
      availability: 'https://schema.org/OutOfStock',
    });
    expect(product.offers?.offers).toHaveLength(3);
  });

  it('reports InStock when any variant can be sold', () => {
    const data = productJsonLd({
      ...base,
      offers: [offer('A', '10.00', 1000n, false), offer('B', '12.00', 1200n, true)],
    });
    expect((data['@graph'] as ProductNode[])[0]!.offers?.availability).toBe(
      'https://schema.org/InStock',
    );
  });

  it('leaves offers out when there is no variant, and is safe inside a script tag', () => {
    const data = productJsonLd({ ...base, name: '</script><b>x', offers: [] });
    expect((data['@graph'] as ProductNode[])[0]!.offers).toBeUndefined();
    expect(serializeJsonLd(data)).not.toContain('</script>');
  });
});
