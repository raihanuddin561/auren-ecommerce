import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { closeDatabase, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(closeDatabase);

async function product() {
  return db.product.create({ data: { slug: 'media-shirt', title: 'Shirt' } });
}

const upload = {
  provider: 'vercel-blob',
  storageKey: 'products/AbCdEfGhIjKlMnOpQrStUvWxYz012345.webp',
  contentType: 'image/webp',
  sizeBytes: 12345,
  url: 'https://store.public.blob.vercel-storage.com/products/x.webp',
  alt: 'Charcoal shirt, front view',
};

describe('product_media storage columns (ADR-026)', () => {
  it('stores an upload with its key, content type and size', async () => {
    const { id } = await product();
    const row = await db.productMedia.create({ data: { productId: id, ...upload } });
    expect(row).toMatchObject({
      provider: 'vercel-blob',
      contentType: 'image/webp',
      sizeBytes: 12345,
    });
  });

  // One statement per test: some servers drop the connection after a constraint error.
  it.each(['image/svg+xml', 'text/html', 'image/gif', 'application/pdf'])(
    'refuses content type %s (SVG and anything outside the allowlist)',
    async (contentType) => {
      const { id } = await product();
      await expect(
        db.productMedia.create({ data: { productId: id, ...upload, contentType } }),
      ).rejects.toThrow();
    },
  );

  it('requires a storage key for an upload', async () => {
    const { id } = await product();
    await expect(
      db.productMedia.create({ data: { productId: id, ...upload, storageKey: null } }),
    ).rejects.toThrow();
  });

  it('requires a size for an upload', async () => {
    const { id } = await product();
    await expect(
      db.productMedia.create({ data: { productId: id, ...upload, sizeBytes: null } }),
    ).rejects.toThrow();
  });

  it('refuses an unknown provider', async () => {
    const { id } = await product();
    await expect(
      db.productMedia.create({ data: { productId: id, ...upload, provider: 'cloudinary' } }),
    ).rejects.toThrow();
  });

  it.each([
    'products/short.webp',
    'private/receipts/AbCdEfGhIjKlMnOpQrStUvWxYz012345.webp',
    'products/AbCdEfGhIjKlMnOpQrStUvWxYz012345.pdf',
    '../AbCdEfGhIjKlMnOpQrStUvWxYz012345.webp',
  ])('refuses the storage key %s', async (storageKey) => {
    const { id } = await product();
    await expect(
      db.productMedia.create({ data: { productId: id, ...upload, storageKey } }),
    ).rejects.toThrow();
  });

  it.each([
    'https://evil.example/products/x.webp',
    'https://store.public.blob.vercel-storage.com.evil.example/x.webp',
    'http://store.public.blob.vercel-storage.com/x.webp',
  ])('refuses the Blob URL %s', async (url) => {
    const { id } = await product();
    await expect(
      db.productMedia.create({ data: { productId: id, ...upload, url } }),
    ).rejects.toThrow();
  });

  it('accepts a local upload with a local URL', async () => {
    const { id } = await product();
    const row = await db.productMedia.create({
      data: { productId: id, ...upload, provider: 'local', url: '/api/media/products/x.webp' },
    });
    expect(row.provider).toBe('local');
  });

  it('accepts a static placeholder without key, type or size', async () => {
    const { id } = await product();
    const placeholder = await db.productMedia.create({
      data: { productId: id, url: '/seed/charcoal.svg', alt: 'Placeholder' },
    });
    expect(placeholder.provider).toBe('static');
  });
});
