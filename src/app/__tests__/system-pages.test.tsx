import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

import { NotFoundContent } from '@/components/storefront/not-found-content';
import GlobalError from '../global-error';
import MaintenancePage, { metadata as maintenanceMetadata } from '../maintenance/page';
import { metadata as notFoundMetadata } from '../not-found';
import StorefrontError from '../(storefront)/error';

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('404 page', () => {
  it('is editorial, helpful and kept out of search results', () => {
    const markup = html(<NotFoundContent />);
    expect(markup).toContain('Crafting Something Extraordinary');
    expect(markup).toContain('action="/search"');
    expect(markup).toContain('role="search"');
    expect(markup).toContain('href="/shop"');
    expect(markup).toContain('alt="');
    expect(notFoundMetadata.robots).toMatchObject({ index: false });
  });

  it('has exactly one h1', () => {
    expect(html(<NotFoundContent />).match(/<h1/g)).toHaveLength(1);
  });
});

describe('error pages', () => {
  const error = Object.assign(new Error('boom'), { digest: 'abc123' });

  it('the storefront boundary announces the problem, reassures and offers a retry', () => {
    const markup = html(<StorefrontError error={error} reset={() => undefined} />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Try again');
    expect(markup).toContain('Reference: abc123');
    expect(markup).toContain('If you were placing an order, check your email');
    expect(markup).not.toContain('boom');
  });

  it('the global boundary is self-contained and never leaks the error message', () => {
    const markup = html(<GlobalError error={error} reset={() => undefined} />);
    expect(markup).toContain('<html');
    expect(markup).toContain('Something went wrong');
    expect(markup).toContain('Reference: abc123');
    expect(markup).not.toContain('boom');
    expect(markup).not.toContain('class=');
  });
});

describe('maintenance page', () => {
  it('reassures without implying orders change and is kept out of search results', () => {
    const markup = html(<MaintenancePage />);
    expect(markup).toContain('We are making a few refinements');
    expect(markup).toContain('Orders you have already placed are unaffected');
    expect(markup).not.toMatch(/cancel/i);
    expect(maintenanceMetadata.robots).toMatchObject({ index: false });
  });

  it('offers the concierge and no storefront navigation', () => {
    const markup = html(<MaintenancePage />);
    expect(markup).toContain('Message the concierge');
    expect(markup).not.toContain('aria-label="Primary"');
  });
});
