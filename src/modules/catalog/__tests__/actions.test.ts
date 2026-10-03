import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/errors';
import { toPermissionSet, type Permission, type StaffContext } from '@/lib/permissions';

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  updateTag: vi.fn(),
  createCategory: vi.fn(),
  setProductStatus: vi.fn(),
  createCollection: vi.fn(),
  updateVariants: vi.fn(),
  uploadProductMedia: vi.fn(),
}));

vi.mock('next/cache', () => ({
  updateTag: mocks.updateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  // The real one only rethrows Next.js control flow (redirect, notFound), marked by a digest.
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string } | null)?.digest) throw error;
  },
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('@/lib/staff', () => ({ requireStaff: mocks.requireStaff }));
vi.mock('@/lib/request-meta', () => ({
  getRequestMeta: async () => ({ ip: '198.51.100.9', userAgent: 'vitest' }),
}));
vi.mock('../service', () => ({
  createCategory: mocks.createCategory,
  setProductStatus: mocks.setProductStatus,
  createCollection: mocks.createCollection,
  updateVariants: mocks.updateVariants,
  uploadProductMedia: mocks.uploadProductMedia,
}));

import {
  createCategory,
  createCollection,
  setProductStatus,
  updateVariants,
  uploadProductMedia,
} from '../actions';

const staff = (role: StaffContext['role'], permissions: Permission[]): StaffContext => ({
  id: 'staff-1',
  userId: 'user-1',
  role,
  name: 'Test',
  email: 't@auren.test',
  permissions: toPermissionSet(permissions),
});

const uuid = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e';
const category = {
  name: 'Shirts',
  slug: '',
  parentId: null,
  description: '',
  isActive: true,
  seoTitle: '',
  seoDescription: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createCategory.mockResolvedValue({
    data: { id: uuid, path: 'shirts' },
    tags: ['categories', 'sitemap'],
  });
  mocks.setProductStatus.mockResolvedValue({
    data: { id: uuid, status: 'active' },
    tags: ['products'],
  });
  mocks.createCollection.mockResolvedValue({
    data: { id: uuid, slug: 'a' },
    tags: ['collections'],
  });
});

describe('catalogue actions: guard order (INV-A1)', () => {
  it('rejects unknown keys before anyone is authenticated', async () => {
    const result = await createCategory({ ...category, isAdmin: true });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.requireStaff).not.toHaveBeenCalled();
    expect(mocks.createCategory).not.toHaveBeenCalled();
  });

  it('refuses staff without catalog.write and never reaches the service', async () => {
    mocks.requireStaff.mockResolvedValue(staff('content_editor', ['catalog.read']));
    const result = await createCategory(category);
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mocks.createCategory).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('passes the actor and invalidates every tag when allowed', async () => {
    mocks.requireStaff.mockResolvedValue(staff('admin', ['catalog.write']));
    const result = await createCategory(category);
    expect(result).toEqual({ ok: true, data: { id: uuid, path: 'shirts' } });
    expect(mocks.createCategory).toHaveBeenCalledWith(
      { userId: 'user-1', ip: '198.51.100.9', userAgent: 'vitest', canPublish: false },
      expect.objectContaining({ name: 'Shirts', slug: null }),
    );
    expect(mocks.updateTag.mock.calls.map(([tag]) => tag)).toEqual(['categories', 'sitemap']);
  });

  it('lets the owner through without listing permissions', async () => {
    mocks.requireStaff.mockResolvedValue(staff('owner', []));
    expect((await createCategory(category)).ok).toBe(true);
  });

  it('turns an unauthenticated visitor into a redirect, not a result', async () => {
    mocks.requireStaff.mockRejectedValue(new DomainError('UNAUTHENTICATED'));
    const result = await createCategory(category);
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    expect(mocks.createCategory).not.toHaveBeenCalled();
  });
});

describe('catalogue actions: publishing needs catalog.publish', () => {
  it('requires catalog.publish to change a product status', async () => {
    mocks.requireStaff.mockResolvedValue(staff('content_editor', ['catalog.write']));
    const denied = await setProductStatus({ id: uuid, status: 'active' });
    expect(denied).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    mocks.requireStaff.mockResolvedValue(staff('manager', ['catalog.publish']));
    expect((await setProductStatus({ id: uuid, status: 'active' })).ok).toBe(true);
  });

  it('requires catalog.publish only when the collection gets a publish date', async () => {
    const collection = {
      title: 'Linen',
      slug: '',
      description: '',
      type: 'manual',
      rules: { match: 'all', conditions: [] },
      sortOrder: 'manual',
      publishedAt: '',
      isFeatured: false,
      seoTitle: '',
      seoDescription: '',
    };
    mocks.requireStaff.mockResolvedValue(staff('admin', ['catalog.write']));
    expect((await createCollection(collection)).ok).toBe(true);
    const denied = await createCollection({
      ...collection,
      publishedAt: '2026-12-01T09:00:00.000Z',
    });
    expect(denied).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mocks.createCollection).toHaveBeenCalledTimes(1);
  });
});

describe('catalogue actions: input hygiene', () => {
  it('validates variants before touching the service', async () => {
    mocks.requireStaff.mockResolvedValue(staff('owner', []));
    const result = await updateVariants({ productId: uuid, variants: [] });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.updateVariants).not.toHaveBeenCalled();
  });

  it('refuses an upload without a file or alt text', async () => {
    mocks.requireStaff.mockResolvedValue(staff('owner', []));
    const noFile = new FormData();
    noFile.set('productId', uuid);
    noFile.set('alt', 'Front view');
    expect(await uploadProductMedia(noFile)).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION' },
    });

    const noAlt = new FormData();
    noAlt.set('productId', uuid);
    noAlt.set('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }));
    const result = await uploadProductMedia(noAlt);
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.uploadProductMedia).not.toHaveBeenCalled();
  });

  it('refuses an upload over the size cap before reading it', async () => {
    mocks.requireStaff.mockResolvedValue(staff('owner', []));
    const form = new FormData();
    form.set('productId', uuid);
    form.set('alt', 'Front view');
    form.set(
      'file',
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
    );
    const result = await uploadProductMedia(form);
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.uploadProductMedia).not.toHaveBeenCalled();
  });
});
