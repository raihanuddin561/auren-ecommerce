import { readLocalPublicFile } from './local';
import { verifyMediaSignature } from './signing';
import type { MediaProvider } from './types';

const NOT_FOUND = () =>
  new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

const SAFE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  // The response is only ever an image or a download: nothing in it may run or embed anything.
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

/**
 * Local development only: serves a public file from the media directory. Every path segment is
 * joined and then matched against the exact shape of keys we generate, so `..`, encoded
 * separators, backslashes, absolute paths and private keys never reach the filesystem.
 */
export async function serveLocalPublic(root: string, segments: string[]): Promise<Response> {
  const file = await readLocalPublicFile(root, segments.join('/'));
  if (!file) return NOT_FOUND();
  return new Response(new Uint8Array(file.body), {
    headers: {
      ...SAFE_HEADERS,
      'Content-Type': file.contentType,
      'Content-Length': String(file.body.length),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/** Delivers private media (receipts, invoices) to a caller holding a valid signed link. */
export async function servePrivate(
  provider: MediaProvider,
  segments: string[],
  query: URLSearchParams,
  secret: string,
  now = Date.now(),
): Promise<Response> {
  const key = segments.join('/');
  if (!verifyMediaSignature(key, query.get('exp'), query.get('sig'), secret, now)) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  const media = await provider.readPrivate(key);
  if (!media) return NOT_FOUND();
  return new Response(media.stream, {
    headers: {
      ...SAFE_HEADERS,
      'Content-Type': media.contentType,
      'Content-Length': String(media.size),
      'Content-Disposition': 'attachment',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
