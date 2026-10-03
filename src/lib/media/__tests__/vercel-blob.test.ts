import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newMediaKey } from '../keys';

const blob = vi.hoisted(() => ({ put: vi.fn(), del: vi.fn(), get: vi.fn() }));
vi.mock('@vercel/blob', () => blob);

import {
  assertTrustedBlobUrl,
  blobPublicHost,
  blobStoreIdFromToken,
  createVercelBlobProvider,
} from '../vercel-blob';

const TOKEN = 'vercel_blob_rw_AbCd1234Store_notARealSecretForTests'; // secret-scan:allow
const HOST = 'abcd1234store.public.blob.vercel-storage.com';

const provider = () =>
  createVercelBlobProvider({
    token: TOKEN,
    appUrl: 'https://auren.example',
    signingSecret: 'x'.repeat(40),
  });

beforeEach(() => {
  blob.put.mockReset();
  blob.del.mockReset();
  blob.get.mockReset();
});

describe('Blob store host', () => {
  it('is derived from the token', () => {
    expect(blobStoreIdFromToken(TOKEN)).toBe('abcd1234store');
    expect(blobPublicHost(TOKEN)).toBe(HOST);
  });

  it('rejects a malformed token', () => {
    expect(() => blobStoreIdFromToken('nope')).toThrow(/malformed/);
  });

  it('accepts only https URLs on exactly that host', () => {
    expect(assertTrustedBlobUrl(`https://${HOST}/products/a.webp`, HOST)).toContain(HOST);
    for (const bad of [
      `http://${HOST}/a.webp`,
      'https://evil.example/a.webp',
      `https://${HOST}.evil.example/a.webp`,
      `https://evil.example/${HOST}/a.webp`,
      `https://user:pw@${HOST}/a.webp`,
      `https://${HOST}:8443/a.webp`,
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(() => assertTrustedBlobUrl(bad, HOST), bad).toThrow();
    }
  });
});

describe('Vercel Blob provider', () => {
  it('stores public media with a random key, no suffix and no overwrite', async () => {
    const key = newMediaKey('products', 'webp');
    blob.put.mockResolvedValue({ url: `https://${HOST}/${key}`, pathname: key });
    const stored = await provider().put({
      key,
      body: Buffer.from('abc'),
      contentType: 'image/webp',
    });
    expect(blob.put).toHaveBeenCalledWith(key, expect.any(Buffer), {
      access: 'public',
      contentType: 'image/webp',
      token: TOKEN,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    expect(stored).toMatchObject({
      provider: 'vercel-blob',
      key,
      url: `https://${HOST}/${key}`,
      size: 3,
    });
  });

  it('refuses a URL the store returns on another host', async () => {
    const key = newMediaKey('products', 'webp');
    blob.put.mockResolvedValue({ url: `https://evil.example/${key}`, pathname: key });
    await expect(
      provider().put({ key, body: Buffer.from('a'), contentType: 'image/webp' }),
    ).rejects.toThrow(/host/);
  });

  it('stores private media with private access and no URL', async () => {
    const key = newMediaKey('receipts', 'pdf', true);
    blob.put.mockResolvedValue({
      url: `https://abcd1234store.private.blob.vercel-storage.com/${key}`,
    });
    const stored = await provider().putPrivate({
      key,
      body: Buffer.from('%PDF-'),
      contentType: 'application/pdf',
    });
    expect(blob.put.mock.calls[0]?.[2]).toMatchObject({ access: 'private' });
    expect(stored.url).toBe('');
    expect(() => provider().getUrl(key)).toThrow();
    expect(provider().signedReadUrl(key)).toContain('/api/media-private/');
  });

  it('rejects keys that are not ours and mixed visibility', async () => {
    await expect(
      provider().put({ key: '../../x.png', body: Buffer.from('a'), contentType: 'image/png' }),
    ).rejects.toThrow();
    await expect(
      provider().put({
        key: newMediaKey('receipts', 'pdf', true),
        body: Buffer.from('a'),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow();
    await expect(provider().delete('https://evil.example/x')).rejects.toThrow();
    expect(blob.put).not.toHaveBeenCalled();
    expect(blob.del).not.toHaveBeenCalled();
  });

  it('builds the public URL from the store host', () => {
    const key = newMediaKey('products', 'avif');
    expect(provider().getUrl(key)).toBe(`https://${HOST}/${key}`);
  });

  it('reads private media with the token and without the CDN cache', async () => {
    const key = newMediaKey('receipts', 'pdf', true);
    blob.get.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream(),
      blob: { contentType: 'application/pdf', size: 5 },
    });
    const media = await provider().readPrivate(key);
    expect(blob.get).toHaveBeenCalledWith(key, {
      access: 'private',
      token: TOKEN,
      useCache: false,
    });
    expect(media).toMatchObject({ contentType: 'application/pdf', size: 5 });
    expect(await provider().readPrivate(newMediaKey('products', 'png'))).toBeNull();
  });
});
