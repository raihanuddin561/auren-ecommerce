import { describe, expect, it } from 'vitest';
import { absoluteUrl, breadcrumbList, collectionPage, itemList, serializeJsonLd } from '../jsonld';

const ORIGIN = 'https://auren.example';

describe('absoluteUrl', () => {
  it('joins a path to the origin and leaves absolute URLs alone', () => {
    expect(absoluteUrl('/shop/shirts', ORIGIN)).toBe('https://auren.example/shop/shirts');
    expect(absoluteUrl('shop', ORIGIN)).toBe('https://auren.example/shop');
    expect(absoluteUrl('https://cdn.example/a.jpg', ORIGIN)).toBe('https://cdn.example/a.jpg');
  });
});

describe('breadcrumbList', () => {
  it('numbers the trail and leaves the current page without an address', () => {
    const node = breadcrumbList(
      [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: 'Shirts' }],
      ORIGIN,
    );
    expect(node['@type']).toBe('BreadcrumbList');
    expect(node.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://auren.example/' },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://auren.example/shop' },
      { '@type': 'ListItem', position: 3, name: 'Shirts' },
    ]);
  });
});

describe('itemList', () => {
  it('lists products with absolute addresses and optional images', () => {
    const node = itemList(
      [
        { name: 'Oxford shirt', path: '/products/oxford-shirt', image: '/seed/white.svg' },
        { name: 'Linen shirt', path: '/products/linen-shirt' },
      ],
      ORIGIN,
    );
    expect(node.numberOfItems).toBe(2);
    expect(node.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        url: 'https://auren.example/products/oxford-shirt',
        name: 'Oxford shirt',
        image: 'https://auren.example/seed/white.svg',
      },
      {
        '@type': 'ListItem',
        position: 2,
        url: 'https://auren.example/products/linen-shirt',
        name: 'Linen shirt',
      },
    ]);
  });
});

describe('collectionPage', () => {
  it('describes the page, its product list and its breadcrumb in one graph', () => {
    const data = collectionPage(
      {
        name: 'Shirts',
        description: 'Cotton and linen shirts.',
        path: '/shop/shirts',
        items: [{ name: 'Oxford shirt', path: '/products/oxford-shirt' }],
        breadcrumb: [{ name: 'Home', path: '/' }, { name: 'Shirts' }],
      },
      ORIGIN,
    );
    expect(data['@context']).toBe('https://schema.org');
    const page = (data['@graph'] as Array<Record<string, unknown>>)[0]!;
    expect(page['@type']).toBe('CollectionPage');
    expect(page.url).toBe('https://auren.example/shop/shirts');
    expect(page.description).toBe('Cotton and linen shirts.');
    expect((page.mainEntity as Record<string, unknown>)['@type']).toBe('ItemList');
    expect((page.breadcrumb as Record<string, unknown>)['@type']).toBe('BreadcrumbList');
  });

  it('leaves out an empty description', () => {
    const data = collectionPage(
      { name: 'Shop', path: '/shop', items: [], breadcrumb: [], description: null },
      ORIGIN,
    );
    expect((data['@graph'] as Array<Record<string, unknown>>)[0]).not.toHaveProperty('description');
  });
});

describe('serializeJsonLd', () => {
  it('cannot close the script tag from inside the data', () => {
    const text = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('</script>');
    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
