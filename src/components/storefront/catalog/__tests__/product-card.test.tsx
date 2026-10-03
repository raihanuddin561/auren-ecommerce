import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { serialize, money } from '@/lib/money';
import { CategoryTiles } from '../category-tiles';
import { ProductCard, type ProductCardView } from '../product-card';
import { ProductGrid } from '../product-grid';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const product = (overrides: Partial<ProductCardView> = {}): ProductCardView => ({
  id: 'p1',
  slug: 'oxford-shirt',
  title: 'Oxford shirt',
  categoryName: 'Shirts',
  price: serialize(money(249000n, 'BDT')),
  compareAt: null,
  image: { url: '/seed/sky-blue.svg', alt: 'Oxford shirt in sky blue', width: 800, height: 1000 },
  hoverImage: { url: '/seed/navy.svg', alt: 'Oxford shirt, back' },
  ...overrides,
});

describe('ProductCard', () => {
  it('links to the product, shows title, category and the image alt text', () => {
    const out = html(<ProductCard product={product()} />);
    expect(out).toContain('href="/products/oxford-shirt"');
    expect(out).toContain('Oxford shirt');
    expect(out).toContain('Shirts');
    expect(out).toContain('alt="Oxford shirt in sky blue"');
    expect(out).toContain('aspect-4/5');
  });

  it('shows the price with the taka sign and no compare-at when not reduced', () => {
    const out = html(<ProductCard product={product()} />);
    expect(out).toContain('৳2,490');
    expect(out).not.toContain('<s ');
  });

  it('shows a struck-through compare-at price when reduced', () => {
    const out = html(
      <ProductCard
        product={product({
          price: serialize(money(199000n, 'BDT')),
          compareAt: serialize(money(249000n, 'BDT')),
        })}
      />,
    );
    expect(out).toContain('৳1,990');
    expect(out).toMatch(/<s [^>]*>৳2,490<\/s>/);
    expect(out).toContain('was ');
  });

  it('keeps the second image decorative so the name is announced once', () => {
    const out = html(<ProductCard product={product()} />);
    expect(out).toContain('img-swap');
    expect(out.match(/alt=""/g)).toHaveLength(1);
  });

  it('renders a placeholder, not a broken image, without a picture', () => {
    const out = html(<ProductCard product={product({ image: null, hoverImage: null })} />);
    expect(out).not.toContain('<img');
    expect(out).toContain('Oxford shirt');
  });

  it('uses a plain image for a remote address that next/image would refuse', () => {
    const out = html(
      <ProductCard
        product={product({
          image: { url: 'https://cdn.example.com/a.webp', alt: 'Remote', width: 800, height: 1000 },
          hoverImage: null,
        })}
      />,
    );
    expect(out).toContain('src="https://cdn.example.com/a.webp"');
    expect(out).toContain('width="800"');
    expect(out).not.toContain('/_next/image');
  });
});

describe('ProductGrid and CategoryTiles', () => {
  it('lists every product once under an accessible name', () => {
    const out = html(
      <ProductGrid
        label="New arrivals"
        products={[product(), product({ id: 'p2', slug: 'linen-trouser', title: 'Linen trouser' })]}
      />,
    );
    expect(out).toContain('aria-label="New arrivals"');
    expect(out).toContain('/products/linen-trouser');
    expect(out.match(/<li/g)).toHaveLength(2);
  });

  it('links tiles to the shop path and falls back to a typographic tile', () => {
    const out = html(
      <CategoryTiles
        categories={[
          { id: 'c1', name: 'Shirts', path: 'shirts', image: null, imageAlt: null },
          {
            id: 'c2',
            name: 'Casual',
            path: 'shirts/casual',
            image: '/seed/ivory.svg',
            imageAlt: 'Casual shirts',
          },
        ]}
      />,
    );
    expect(out).toContain('href="/shop/shirts"');
    expect(out).toContain('href="/shop/shirts/casual"');
    expect(out).toContain('alt="Casual shirts"');
  });
});
