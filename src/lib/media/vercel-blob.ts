import { del, get, put } from '@vercel/blob';
import { isPrivateKey, isPublicImageKey, isValidMediaKey } from './keys';
import { signMediaUrl } from './signing';
import type { MediaProvider, PrivateMedia, PutMediaInput, StoredMedia } from './types';

/** Store id inside a read-write token: `vercel_blob_rw_<storeId>_<secret>` (as the SDK parses it). */
export function blobStoreIdFromToken(token: string): string {
  const storeId = token.split('_')[3] ?? '';
  if (!/^[A-Za-z0-9]{6,}$/.test(storeId)) throw new Error('BLOB_READ_WRITE_TOKEN is malformed');
  return storeId.toLowerCase();
}

/** The only host public media may be served from. */
export const blobPublicHost = (token: string): string =>
  `${blobStoreIdFromToken(token)}.public.blob.vercel-storage.com`;

/** A returned URL is only stored or rendered when it is https and on the configured store host. */
export function assertTrustedBlobUrl(url: string, host: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('media URL is not a valid URL');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== host.toLowerCase()) {
    throw new Error('media URL is not on the configured Blob store host');
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new Error('media URL must not carry credentials or a port');
  }
  return parsed.toString();
}

export interface VercelBlobConfig {
  token: string;
  appUrl: string;
  signingSecret: string;
}

export function createVercelBlobProvider(config: VercelBlobConfig): MediaProvider {
  const host = blobPublicHost(config.token);
  const token = config.token;
  const checkKey = (key: string, isPrivate: boolean) => {
    if (!isValidMediaKey(key)) throw new Error('invalid media key');
    if (!isPrivate && !isPublicImageKey(key)) throw new Error('public media must be an image');
    if (isPrivateKey(key) !== isPrivate) {
      throw new Error(
        isPrivate ? 'private media needs a private key' : 'public media needs a public key',
      );
    }
  };
  const store = async (
    { key, body, contentType }: PutMediaInput,
    isPrivate: boolean,
  ): Promise<StoredMedia> => {
    checkKey(key, isPrivate);
    const result = await put(key, body, {
      access: isPrivate ? 'private' : 'public',
      contentType,
      token,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return {
      provider: 'vercel-blob',
      key,
      url: isPrivate ? '' : assertTrustedBlobUrl(result.url, host),
      contentType,
      size: body.length,
    };
  };

  return {
    kind: 'vercel-blob',
    put: (input) => store(input, false),
    putPrivate: (input) => store(input, true),
    async delete(key) {
      if (!isValidMediaKey(key)) throw new Error('invalid media key');
      await del(key, { token });
    },
    getUrl(key) {
      checkKey(key, false);
      return assertTrustedBlobUrl(`https://${host}/${key}`, host);
    },
    async readPrivate(key): Promise<PrivateMedia | null> {
      if (!isValidMediaKey(key) || !isPrivateKey(key)) return null;
      const result = await get(key, { access: 'private', token, useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return {
        stream: result.stream,
        contentType: result.blob.contentType,
        size: result.blob.size,
      };
    },
    signedReadUrl(key, ttlSeconds = 300) {
      checkKey(key, true);
      return signMediaUrl(config.appUrl, key, config.signingSecret, ttlSeconds);
    },
  };
}
