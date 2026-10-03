/**
 * Media storage behind one interface (ADR-026): the local filesystem in development and tests,
 * Vercel Blob in production. Public media (product images) has a stable public URL; private media
 * (receipts, invoices) has none and is only read through short-lived signed links that a route
 * handler verifies.
 */
export type MediaKind = 'local' | 'vercel-blob';

export interface PutMediaInput {
  /** Storage key from newMediaKey(); never derived from a user supplied file name. */
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredMedia {
  provider: MediaKind;
  /** Storage key, kept in the database (product_media.storage_key). */
  key: string;
  /** Public URL (empty for private media). */
  url: string;
  contentType: string;
  size: number;
}

export interface PrivateMedia {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}

export interface MediaProvider {
  readonly kind: MediaKind;
  /** Stores public media and returns its URL, already checked against the trusted host. */
  put(input: PutMediaInput): Promise<StoredMedia>;
  /** Stores private media (receipts, invoices): no public URL exists. */
  putPrivate(input: PutMediaInput): Promise<StoredMedia>;
  /** Removes public or private media; a missing object is not an error. */
  delete(key: string): Promise<void>;
  /** Public URL of a public key. Throws for private keys. */
  getUrl(key: string): string;
  /** Reads private media for a route handler that already verified a signed link. */
  readPrivate(key: string): Promise<PrivateMedia | null>;
  /** Short-lived signed link to private media, served by the media route handler. */
  signedReadUrl(key: string, ttlSeconds?: number): string;
}
