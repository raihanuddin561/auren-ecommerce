import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { money, serialize } from '@/lib/money';
import { EMPTY_QUERY } from '@/modules/catalog/listing';
import { ActiveFilters, ListingEmpty, activeFilters } from '../listing-parts';
import { ProductCard, type ProductCardView } from '../product-card';
import { ProductGrid } from '../product-grid';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const img = (url: string, alt: string) => ({ url, alt, width: 800, height: 1000 });

const base = (overrides: Partial<ProductCardView> = {}): ProductCardView => ({
  id: 'p1',
  slug: 'oxford-shirt',
  title: 'Oxford shirt',
  categoryName: 'Shirts',
  price: serialize(money(249000n, 'BDT')),
  compareAt: null,
  image: img('/seed/white.svg', 'Oxford shirt in white'),
  hoverImage: img('/seed/ivory.svg', 'Oxford shirt, detail'),
  colors: [
    {
      id: 'c-white',
      label: 'White',
      hex: '#F8F8F6',
      image: img('/seed/white.svg', 'Oxford shirt in white'),
      hoverImage: img('/seed/ivory.svg', 'detail'),
    },
    {
      id: 'c-navy',
      label: 'Navy',
      hex: '#1F2A44',
      image: img('/seed/navy.svg', 'Oxford shirt in navy'),
      hoverImage: null,
    },
  ],
  sizes: ['S', 'M'],
  variants: [
    { id: 'v1', colorId: 'c-white', size: 'S', available: 6 },
    { id: 'v2', colorId: 'c-white', size: 'M', available: 0 },
    { id: 'v3', colorId: 'c-navy', size: 'S', available: 3 },
    { id: 'v4', colorId: 'c-navy', size: 'M', available: 3 },
  ],
  isNew: false,
  limited: false,
  stock: 'in',
  ...overrides,
});

describe('ProductCard structure', () => {
  it('is one link to the product, with no interactive element nested inside it', () => {
    const out = html(<ProductCard product={base()} />);
    const links = out.match(/<a [^>]*>[\s\S]*?<\/a>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href="/products/oxford-shirt"');
    expect(links[0]).not.toMatch(/<(button|input|select|textarea)\b/i);
    expect(links[0]).toContain('Oxford shirt');
    // The link is stretched over the card, not wrapped around the buttons.
    expect(links[0]).toContain('after:absolute');
  });

  it('keeps heart, swatches and sizes as siblings positioned above the link', () => {
    const out = html(<ProductCard product={base()} />);
    expect(out).toContain('aria-label="Add Oxford shirt to wishlist"');
    expect(out).toContain('aria-pressed="false"');
    expect(out.match(/z-20/g)!.length).toBeGreaterThanOrEqual(3);
  });
});

describe('ProductCard swatches', () => {
  it('renders one labelled button per colour with the chosen one pressed', () => {
    const out = html(<ProductCard product={base()} />);
    expect(out).toMatch(/<button[^>]*aria-label="White"[^>]*aria-pressed="true"/);
    expect(out).toMatch(/<button[^>]*aria-label="Navy"[^>]*aria-pressed="false"/);
  });

  it('shows no swatches for a single colour', () => {
    const only = base().colors![0]!;
    const out = html(<ProductCard product={base({ colors: [only] })} />);
    expect(out).not.toContain('aria-label="Colours"');
  });

  it('counts the colours that do not fit on a phone', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      label: `Colour ${i}`,
      hex: '#cccccc',
      image: img('/seed/white.svg', 'x'),
      hoverImage: null,
    }));
    const out = html(<ProductCard product={base({ colors: many })} />);
    expect(out).toContain('2 more colours');
  });
});

describe('ProductCard quick add', () => {
  it('offers the sizes of the chosen colour, striking through those without stock', () => {
    const out = html(<ProductCard product={base()} />);
    expect(out).toContain('aria-label="Quick add, Oxford shirt"');
    expect(out).toContain('aria-label="Add size S to bag"');
    // White / M has no stock.
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-label="M, sold out"/);
  });

  it('is left out while the live stock is unknown', () => {
    const unknown = base({
      stock: null,
      variants: base().variants!.map((v) => ({ ...v, available: null })),
    });
    expect(html(<ProductCard product={unknown} />)).not.toContain('Quick add');
  });

  it('is left out for a product without sizes', () => {
    expect(html(<ProductCard product={base({ sizes: [], variants: [] })} />)).not.toContain(
      'Quick add',
    );
  });
});

describe('ProductCard badges', () => {
  it('shows Sold out, Low stock, New and Limited from the data', () => {
    expect(html(<ProductCard product={base({ stock: 'out' })} />)).toContain('Sold out');
    expect(html(<ProductCard product={base({ stock: 'low' })} />)).toContain('Low stock');
    expect(html(<ProductCard product={base({ isNew: true })} />)).toContain('>New<');
    const limited = html(<ProductCard product={base({ limited: true })} />);
    expect(limited).toContain('>Limited<');
    expect(html(<ProductCard product={base()} />)).not.toContain('Limited');
  });

  it('shows no stock badge until the live stock is known', () => {
    const out = html(<ProductCard product={base({ stock: null })} />);
    expect(out).not.toContain('Sold out');
    expect(out).not.toContain('Low stock');
  });
});

describe('ProductCard images', () => {
  it('is a stone block with the alt text kept when the product has no picture', () => {
    const out = html(<ProductCard product={base({ image: null, hoverImage: null, colors: [] })} />);
    expect(out).not.toContain('<img');
    expect(out).toContain('bg-sunken');
  });

  it('uses the first colour picture and the hover picture of that colour', () => {
    const out = html(<ProductCard product={base()} />);
    expect(out).toContain('alt="Oxford shirt in white"');
    expect(out).toContain('img-swap');
  });

  it('sets the blur and dominant colour from stored data', () => {
    const out = html(
      <ProductCard
        product={base({
          image: { ...img('/seed/white.svg', 'white'), dominantColor: '#F8F8F6', blurData: null },
        })}
      />,
    );
    expect(out).toContain('background-color:#F8F8F6');
  });
});

describe('ProductGrid density', () => {
  it('uses the chosen columns and the default otherwise', () => {
    const cards = [base()];
    expect(html(<ProductGrid products={cards} label="x" />)).toContain('md:grid-cols-4');
    expect(html(<ProductGrid products={cards} label="x" density={2} />)).toContain(
      'md:grid-cols-2',
    );
    expect(html(<ProductGrid products={cards} label="x" density={1} />)).toContain('grid-cols-1');
  });
});

describe('listing parts', () => {
  const query = {
    ...EMPTY_QUERY,
    size: ['M'],
    color: ['sky-blue'],
    minPrice: '1000',
    inStock: true,
  };

  it('lists each active filter with a link that removes just that one', () => {
    const filters = activeFilters('/shop/shirts', query);
    expect(filters.map((f) => f.label)).toEqual([
      'Size M',
      'sky blue',
      'From ৳1000',
      'In stock only',
    ]);
    expect(filters[0]!.href).toBe('/shop/shirts?color=sky-blue&min=1000&instock=1');
    expect(filters[2]!.href).toBe('/shop/shirts?size=M&color=sky-blue&instock=1');
  });

  it('renders nothing when no filter is active', () => {
    expect(html(<ActiveFilters basePath="/shop" query={EMPTY_QUERY} />)).toBe('');
  });

  it('says no pieces match, offers to clear the filters and suggests new arrivals', () => {
    const out = html(
      <ListingEmpty basePath="/shop" query={query} filtered suggestions={[base()]} />,
    );
    expect(out).toContain('No pieces match these filters');
    expect(out).toContain('Clear filters');
    expect(out).toContain('href="/shop"');
    expect(out).toContain('New arrivals');
    expect(out).not.toContain('!');
  });

  it('keeps the sort when filters are cleared', () => {
    const out = html(
      <ListingEmpty
        basePath="/shop"
        query={{ ...query, sort: 'newest' }}
        filtered
        suggestions={[]}
      />,
    );
    expect(out).toContain('href="/shop?sort=newest"');
  });
});
