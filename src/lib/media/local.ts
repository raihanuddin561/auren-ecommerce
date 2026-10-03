import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { isPrivateKey, isPublicImageKey, isValidMediaKey } from './keys';
import { signMediaUrl } from './signing';
import type { MediaProvider, PrivateMedia, PutMediaInput, StoredMedia } from './types';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

export const contentTypeForKey = (key: string): string =>
  CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';

/**
 * Maps a storage key to a file inside `root`, or null. The key must have exactly the shape
 * newMediaKey() produces (so no `..`, no separators other than one `/`, no backslashes, no drive
 * letters, no encoded characters), and the resolved path must still lie inside the root.
 */
export function resolveInsideRoot(root: string, key: string): string | null {
  if (!isValidMediaKey(key)) return null;
  const base = path.resolve(root);
  const target = path.resolve(base, ...key.split('/'));
  const relative = path.relative(base, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

export interface LocalMediaConfig {
  root: string;
  /** Public path the route handler listens on, without a trailing slash. */
  publicPath?: string;
  /** Base URL of the app, for signed links. */
  appUrl: string;
  /** Secret used to sign private links. */
  signingSecret: string;
}

export function createLocalMediaProvider(config: LocalMediaConfig): MediaProvider {
  const publicPath = config.publicPath ?? '/api/media';
  const fileFor = (key: string): string => {
    const file = resolveInsideRoot(config.root, key);
    if (!file) throw new Error('invalid media key');
    return file;
  };
  const write = async (
    { key, body, contentType }: PutMediaInput,
    isPrivate: boolean,
  ): Promise<StoredMedia> => {
    if (isPrivateKey(key) !== isPrivate) {
      throw new Error(
        isPrivate ? 'private media needs a private key' : 'public media needs a public key',
      );
    }
    if (!isPrivate && !isPublicImageKey(key)) throw new Error('public media must be an image');
    const file = fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body, { flag: 'wx' });
    return {
      provider: 'local',
      key,
      url: isPrivate ? '' : `${publicPath}/${key}`,
      contentType,
      size: body.length,
    };
  };

  return {
    kind: 'local',
    put: (input) => write(input, false),
    putPrivate: (input) => write(input, true),
    async delete(key) {
      await rm(fileFor(key), { force: true });
    },
    getUrl(key) {
      if (isPrivateKey(key)) throw new Error('private media has no public URL');
      if (!isPublicImageKey(key)) throw new Error('invalid media key');
      return `${publicPath}/${key}`;
    },
    async readPrivate(key): Promise<PrivateMedia | null> {
      if (!isPrivateKey(key)) return null;
      const file = fileFor(key);
      try {
        const info = await stat(file);
        return {
          stream: Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>,
          contentType: contentTypeForKey(key),
          size: info.size,
        };
      } catch {
        return null;
      }
    },
    signedReadUrl(key, ttlSeconds = 300) {
      if (!isPrivateKey(key)) throw new Error('only private media is delivered with a signed link');
      fileFor(key);
      return signMediaUrl(config.appUrl, key, config.signingSecret, ttlSeconds);
    },
  };
}

/** Reads a public file for the local media route; null when the key is invalid or missing. */
export async function readLocalPublicFile(
  root: string,
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!isPublicImageKey(key)) return null;
  const file = resolveInsideRoot(root, key);
  if (!file) return null;
  try {
    return { body: await readFile(file), contentType: contentTypeForKey(key) };
  } catch {
    return null;
  }
}
