import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listingFor: vi.fn(),
  withLiveStock: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string } | null)?.digest) throw error;
  },
}));
vi.mock('@/lib/request-meta', () => ({
  getRequestMeta: async () => ({ ip: '198.51.100.9', userAgent: 'vitest' }),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('../load', () => ({ listingFor: mocks.listingFor, withLiveStock: mocks.withLiveStock }));

import { loadMoreProducts } from '../actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.listingFor.mockResolvedValue({ cards: [{ id: 'p25' }], totalPages: 3 });
  mocks.withLiveStock.mockImplementation(async (cards: unknown[]) => cards);
});

const valid = { scope: { kind: 'shop', path: 'shirts/oxford' }, search: 'color=white', page: 2 };

describe('loadMoreProducts', () => {
  it('returns the next page with live stock and whether more follow', async () => {
    const result = await loadMoreProducts(valid);
    expect(result).toEqual({ ok: true, data: { cards: [{ id: 'p25' }], hasMore: true } });
    expect(mocks.listingFor).toHaveBeenCalledWith(
      valid.scope,
      expect.objectContaining({ color: ['white'], page: 2 }),
    );
    expect(mocks.withLiveStock).toHaveBeenCalled();
  });

  it('says there is nothing more on the last page', async () => {
    const result = await loadMoreProducts({ ...valid, page: 3 });
    expect(result).toMatchObject({ ok: true, data: { hasMore: false } });
  });

  it('parses the query string with the page rules: invalid values are ignored', async () => {
    await loadMoreProducts({ ...valid, search: 'sort=cheapest&size=M&size=L&evil=1&page=9' });
    expect(mocks.listingFor).toHaveBeenCalledWith(
      valid.scope,
      expect.objectContaining({ sort: 'featured', size: ['L', 'M'], page: 2 }),
    );
  });

  it('accepts collections and refuses anything malformed or unknown', async () => {
    expect(
      await loadMoreProducts({
        scope: { kind: 'collection', slug: 'summer-edit' },
        search: '',
        page: 2,
      }),
    ).toMatchObject({ ok: true });

    for (const input of [
      null,
      { ...valid, page: 1 },
      { ...valid, page: 501 },
      { ...valid, page: 2.5 },
      { ...valid, extra: true },
      { ...valid, scope: { kind: 'shop', path: '../etc' } },
      { ...valid, scope: { kind: 'shop', path: 'a/b/c/d' } },
      { ...valid, scope: { kind: 'collection', slug: 'Bad Slug' } },
      { ...valid, scope: { kind: 'other' } },
      { ...valid, search: 'x'.repeat(601) },
    ]) {
      expect(await loadMoreProducts(input)).toMatchObject({
        ok: false,
        error: { code: 'VALIDATION' },
      });
    }
  });

  it('is rate limited per address', async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect(await loadMoreProducts(valid)).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED' },
    });
    expect(mocks.rateLimit).toHaveBeenCalledWith('listingMore', '198.51.100.9');
    expect(mocks.listingFor).not.toHaveBeenCalled();
  });

  it('reports a missing category or collection', async () => {
    mocks.listingFor.mockResolvedValue(null);
    expect(await loadMoreProducts(valid)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });
});
