import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/cn';
import { money } from '@/lib/money';
import { Badge } from '../badge';
import { Breadcrumb } from '../breadcrumb';
import { Button, IconButton } from '../button';
import { EmptyState } from '../empty-state';
import { FormField } from '../form-field';
import { Input } from '../input';
import { Pagination, pageWindow } from '../pagination';
import { Price } from '../price';
import { Rating, normalizeRating, ratingLabel } from '../rating';
import { Skeleton, SkeletonRegion } from '../skeleton';
import { Textarea } from '../textarea';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const bdt = (minor: number) => money(BigInt(minor), 'BDT');
const shopHref = (page: number) => '/shop?page=' + page;

describe('cn', () => {
  it('lets the later utility win and understands brand type sizes', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
    expect(cn('text-small', 'text-page')).toBe('text-small text-page');
    expect(cn('text-small', 'text-h3')).toBe('text-h3');
    expect(cn('type-h1', 'type-h2')).toBe('type-h2');
    expect(cn('tracking-wide', 'tracking-button')).toBe('tracking-button');
  });
});

describe('Button', () => {
  it('is a typed button that never submits a form by accident', () => {
    expect(html(<Button>Add to bag</Button>)).toContain('type="button"');
  });

  it('can be a submit button', () => {
    expect(html(<Button type="submit">Place order</Button>)).toContain('type="submit"');
  });

  it('reports a busy state while loading and keeps its label', () => {
    const markup = html(<Button loading>Saving</Button>);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('Saving');
  });

  it('is disabled when asked', () => {
    expect(html(<Button disabled>Unavailable</Button>)).toContain('disabled=""');
  });

  it('uses sharp corners and tokens, never a raw colour', () => {
    const markup = html(<Button variant="primary">Shop</Button>);
    expect(markup).toContain('rounded-sm');
    expect(markup).toContain('bg-fg');
    expect(markup).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('gives icon buttons a 44px target and an accessible name', () => {
    const markup = html(<IconButton aria-label="Search">x</IconButton>);
    expect(markup).toContain('aria-label="Search"');
    expect(markup).toContain('size-11');
  });
});

describe('Input and Textarea', () => {
  it('marks invalid controls for assistive tech', () => {
    expect(html(<Input invalid />)).toContain('aria-invalid="true"');
    expect(html(<Textarea invalid />)).toContain('aria-invalid="true"');
  });

  it('leaves valid controls without aria-invalid', () => {
    expect(html(<Input />)).not.toContain('aria-invalid="');
  });

  it('renders disabled and read-only states', () => {
    expect(html(<Input disabled />)).toContain('disabled=""');
    expect(html(<Input readOnly />)).toContain('readOnly=""');
  });
});

describe('FormField', () => {
  it('connects label, hint and control', () => {
    const markup = html(
      <FormField label="Email" hint="We only use it for your order">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    const id = /for="([^"]+)"/.exec(markup)?.[1];
    expect(id).toBeTruthy();
    expect(markup).toContain(`id="${id}"`);
    expect(markup).toContain(`aria-describedby="${id}-hint"`);
  });

  it('announces an error and marks the control invalid', () => {
    const markup = html(
      <FormField label="Phone" error="Enter a mobile number">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Enter a mobile number');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toMatch(/aria-describedby="[^"]*-error/);
  });

  it('keeps the alert region present but empty when there is no error', () => {
    const markup = html(<FormField label="Phone">{(control) => <Input {...control} />}</FormField>);
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain('aria-invalid="');
  });

  it('can hide the label visually while keeping it for assistive tech', () => {
    const markup = html(
      <FormField label="Search" hideLabel>
        {(control) => <Input {...control} />}
      </FormField>,
    );
    expect(markup).toContain('sr-only');
  });
});

describe('Price', () => {
  it('formats through the money library', () => {
    expect(html(<Price price={bdt(129900)} />)).toContain('৳1,299');
    expect(html(<Price price={money(1999n, 'USD')} />)).toContain('$19.99');
  });

  it('shows a struck compare-at price with screen reader context when reduced', () => {
    const markup = html(<Price price={bdt(99900)} compareAt={bdt(129900)} />);
    expect(markup).toContain('<s ');
    expect(markup).toContain('was');
    expect(markup).toContain('1,299');
    expect(markup).toContain('999');
  });

  it('ignores a compare-at price that is not higher or is in another currency', () => {
    expect(html(<Price price={bdt(99900)} compareAt={bdt(99900)} />)).not.toContain('<s ');
    expect(html(<Price price={bdt(99900)} compareAt={bdt(50000)} />)).not.toContain('<s ');
    expect(html(<Price price={bdt(99900)} compareAt={money(1_000_000n, 'USD')} />)).not.toContain(
      '<s ',
    );
  });

  it('aligns digits', () => {
    expect(html(<Price price={bdt(100)} />)).toContain('type-price');
  });
});

describe('Rating', () => {
  it('clamps and tolerates bad input', () => {
    expect(normalizeRating(7)).toBe(5);
    expect(normalizeRating(-2)).toBe(0);
    expect(normalizeRating(Number.NaN)).toBe(0);
  });

  it('describes the rating in words', () => {
    expect(ratingLabel(4.3, 128)).toBe('Rated 4.3 out of 5 from 128 reviews');
    expect(ratingLabel(5, 1)).toBe('Rated 5 out of 5 from 1 review');
    expect(ratingLabel(3)).toBe('Rated 3 out of 5');
  });

  it('exposes one image role with the label and clips partial stars', () => {
    const markup = html(<Rating value={4.5} count={12} />);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Rated 4.5 out of 5 from 12 reviews"');
    expect(markup).toContain('width:50%');
  });
});

describe('Pagination', () => {
  it('shows the edges and a window around the current page', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, null, 5]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('renders nothing for a single page', () => {
    expect(html(<Pagination page={1} totalPages={1} hrefFor={shopHref} />)).toBe('');
  });

  it('renders crawlable links with the current page marked', () => {
    const markup = html(<Pagination page={2} totalPages={4} hrefFor={shopHref} />);
    expect(markup).toContain('href="/shop?page=3"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('rel="prev"');
    expect(markup).toContain('rel="next"');
  });
});

describe('Breadcrumb', () => {
  it('marks the last item as the current page and links ancestors', () => {
    const markup = html(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Shirts', href: '/shirts' },
          { label: 'Oxford' },
        ]}
      />,
    );
    expect(markup).toContain('aria-label="Breadcrumb"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('href="/shirts"');
  });
});

describe('Skeleton, Badge, EmptyState', () => {
  it('hides a lone skeleton and announces a loading region', () => {
    expect(html(<Skeleton className="h-4 w-10" />)).toContain('aria-hidden="true"');
    const region = html(
      <SkeletonRegion label="Loading products">
        <Skeleton className="h-4" />
      </SkeletonRegion>,
    );
    expect(region).toContain('role="status"');
    expect(region).toContain('aria-busy="true"');
  });

  it('renders badge tones', () => {
    expect(html(<Badge tone="oxblood">Limited</Badge>)).toContain('bg-oxblood');
    expect(html(<Badge>New</Badge>)).toContain('bg-fg/10');
  });

  it('announces error states and not empty ones', () => {
    expect(html(<EmptyState tone="error" title="Something went wrong" />)).toContain(
      'role="alert"',
    );
    expect(html(<EmptyState title="No pieces match these filters" />)).not.toContain(
      'role="alert"',
    );
  });
});
