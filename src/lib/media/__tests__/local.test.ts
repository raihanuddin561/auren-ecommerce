import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isPrivateKey, isValidMediaKey, newMediaKey } from '../keys';
import { createLocalMediaProvider, resolveInsideRoot } from '../local';
import { serveLocalPublic, servePrivate } from '../serve';
import { signMediaUrl, verifyMediaSignature } from '../signing';

let root: string;
let outside: string;
const SECRET = 'unit-test-signing-secret-0123456789';

beforeAll(async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'auren-media-'));
  root = path.join(base, 'media');
  outside = path.join(base, 'outside.txt');
  await mkdir(root, { recursive: true });
  await writeFile(outside, 'top secret');
});
afterAll(async () => rm(path.dirname(root), { recursive: true, force: true }));

const provider = () =>
  createLocalMediaProvider({ root, appUrl: 'http://localhost:3000', signingSecret: SECRET });

describe('media keys', () => {
  it('are random, shaped by scope and extension, and never carry a user file name', () => {
    const a = newMediaKey('products', 'webp');
    const b = newMediaKey('products', 'webp');
    expect(a).toMatch(/^products\/[A-Za-z0-9_-]{32}\.webp$/);
    expect(a).not.toBe(b);
    expect(isValidMediaKey(a)).toBe(true);
    expect(isPrivateKey(newMediaKey('receipts', 'pdf', true))).toBe(true);
  });

  it('refuse a scope or extension that is not on the allowlist', () => {
    expect(() => newMediaKey('../x', 'webp')).toThrow();
    expect(() => newMediaKey('Products', 'webp')).toThrow();
    expect(() => newMediaKey('products', 'svg')).toThrow();
    expect(() => newMediaKey('products', 'html')).toThrow();
    expect(() => newMediaKey('private', 'webp')).toThrow();
    expect(() => newMediaKey('products', 'pdf')).toThrow(/image/);
  });
});

describe('path traversal', () => {
  const attacks = [
    '../outside.txt',
    '../../outside.txt',
    'products/../../outside.txt',
    '..%2f..%2foutside.txt',
    'products/..%2foutside.txt',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    'C:/Windows/win.ini',
    'products\\..\\..\\outside.txt',
    'products/aaaaaaaaaaaaaaaaaaaaaaaa.webp/../../../outside.txt',
    'products/aaaaaaaaaaaaaaaaaaaaaaaa.webp\0.png',
    '.',
    '',
    'products/a.svg',
    'products/aaaaaaaaaaaaaaaaaaaaaaaa.svg',
  ];

  it.each(attacks)('resolveInsideRoot refuses %j', (attack) => {
    expect(resolveInsideRoot(root, attack)).toBeNull();
  });

  it.each(attacks)('the route refuses %j with a 404', async (attack) => {
    const response = await serveLocalPublic(root, attack.split('/'));
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('top secret');
  });

  it('the route refuses segments that decode to a traversal', async () => {
    const response = await serveLocalPublic(root, ['..', 'outside.txt']);
    expect(response.status).toBe(404);
  });

  it('stays inside the root for a valid key', () => {
    const key = newMediaKey('products', 'webp');
    const file = resolveInsideRoot(root, key);
    expect(file && path.relative(root, file).startsWith('..')).toBe(false);
  });
});

describe('local provider', () => {
  it('stores public media and serves it through the route with safe headers', async () => {
    const key = newMediaKey('products', 'webp');
    const stored = await provider().put({
      key,
      body: Buffer.from('RIFFxxxxWEBP'),
      contentType: 'image/webp',
    });
    expect(stored).toMatchObject({ provider: 'local', key, url: `/api/media/${key}`, size: 12 });
    expect(provider().getUrl(key)).toBe(`/api/media/${key}`);

    const response = await serveLocalPublic(root, key.split('/'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('RIFFxxxxWEBP');
  });

  it('does not overwrite an existing object', async () => {
    const key = newMediaKey('products', 'png');
    await provider().put({ key, body: Buffer.from('a'), contentType: 'image/png' });
    await expect(
      provider().put({ key, body: Buffer.from('b'), contentType: 'image/png' }),
    ).rejects.toThrow();
  });

  it('deletes, and deleting a missing object is not an error', async () => {
    const key = newMediaKey('products', 'png');
    await provider().put({ key, body: Buffer.from('a'), contentType: 'image/png' });
    await provider().delete(key);
    await expect(readFile(resolveInsideRoot(root, key)!)).rejects.toThrow();
    await expect(provider().delete(key)).resolves.toBeUndefined();
  });

  it('keeps private media out of the public route and gives it no public URL', async () => {
    const key = newMediaKey('receipts', 'pdf', true);
    const stored = await provider().putPrivate({
      key,
      body: Buffer.from('%PDF-1.4'),
      contentType: 'application/pdf',
    });
    expect(stored.url).toBe('');
    expect(() => provider().getUrl(key)).toThrow();
    expect((await serveLocalPublic(root, key.split('/'))).status).toBe(404);
    await expect(
      provider().put({ key, body: Buffer.from('x'), contentType: 'application/pdf' }),
    ).rejects.toThrow();
    await expect(
      provider().putPrivate({
        key: newMediaKey('products', 'png'),
        body: Buffer.from('x'),
        contentType: 'image/png',
      }),
    ).rejects.toThrow();
  });
});

describe('private delivery with signed links', () => {
  const now = Date.UTC(2026, 9, 3, 12, 0, 0);

  it('delivers a valid link as a no-store download', async () => {
    const key = newMediaKey('receipts', 'pdf', true);
    await provider().putPrivate({
      key,
      body: Buffer.from('%PDF-1.4 receipt'),
      contentType: 'application/pdf',
    });
    const url = new URL(signMediaUrl('http://localhost:3000', key, SECRET, 300, now));
    expect(url.pathname).toBe(`/api/media-private/${key}`);
    const response = await servePrivate(
      provider(),
      key.split('/'),
      url.searchParams,
      SECRET,
      now + 1000,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe('attachment');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).toBe('%PDF-1.4 receipt');
  });

  it('refuses a missing, expired, tampered or other-key signature', async () => {
    const key = newMediaKey('receipts', 'pdf', true);
    const other = newMediaKey('receipts', 'pdf', true);
    await provider().putPrivate({
      key,
      body: Buffer.from('%PDF-1.4'),
      contentType: 'application/pdf',
    });
    const q = new URL(signMediaUrl('http://localhost:3000', key, SECRET, 60, now)).searchParams;
    const status = async (k: string, params: URLSearchParams, at = now) =>
      (await servePrivate(provider(), k.split('/'), params, SECRET, at)).status;

    expect(await status(key, new URLSearchParams())).toBe(403);
    expect(await status(key, q, now + 61_000)).toBe(403);
    expect(await status(other, q)).toBe(403);
    const forged = new URLSearchParams(q);
    forged.set('exp', String(Number(q.get('exp')) + 3000));
    expect(await status(key, forged)).toBe(403);
    expect(verifyMediaSignature(key, q.get('exp'), q.get('sig'), 'another-secret', now)).toBe(
      false,
    );
    expect(await status(key, q)).toBe(200);
  });

  it('caps the lifetime of a link at one hour and refuses public keys', () => {
    const key = newMediaKey('receipts', 'pdf', true);
    const q = new URL(signMediaUrl('http://localhost:3000', key, SECRET, 999_999, now))
      .searchParams;
    expect(Number(q.get('exp')) - now / 1000).toBe(3600);
    expect(() => provider().signedReadUrl(newMediaKey('products', 'png'))).toThrow();
  });

  it('does not deliver a public key through the private route even with a valid signature', async () => {
    const key = newMediaKey('products', 'png');
    await provider().put({ key, body: Buffer.from('x'), contentType: 'image/png' });
    const q = new URL(signMediaUrl('http://localhost:3000', key, SECRET, 60, now)).searchParams;
    expect((await servePrivate(provider(), key.split('/'), q, SECRET, now)).status).toBe(404);
  });
});
