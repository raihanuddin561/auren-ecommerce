import 'server-only';
import path from 'node:path';
import { env } from '@/lib/env';
import { createLocalMediaProvider } from './local';
import type { MediaProvider } from './types';
import { createVercelBlobProvider } from './vercel-blob';

export const DEFAULT_MEDIA_LOCAL_DIR = '.local-media';

export function localMediaRoot(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    env.MEDIA_LOCAL_DIR || DEFAULT_MEDIA_LOCAL_DIR,
  );
}

let cached: MediaProvider | undefined;

/**
 * BLOB_READ_WRITE_TOKEN present: Vercel Blob. Absent: the local filesystem (development and
 * tests only; production refuses to boot without the token).
 */
export function getMediaProvider(): MediaProvider {
  cached ??= env.BLOB_READ_WRITE_TOKEN
    ? createVercelBlobProvider({
        token: env.BLOB_READ_WRITE_TOKEN,
        appUrl: env.APP_URL,
        signingSecret: env.BETTER_AUTH_SECRET,
      })
    : createLocalMediaProvider({
        root: localMediaRoot(),
        appUrl: env.APP_URL,
        signingSecret: env.BETTER_AUTH_SECRET,
      });
  return cached;
}

export type { MediaProvider, StoredMedia, PutMediaInput } from './types';
export { newMediaKey } from './keys';
export { validateUpload, processImage } from './upload';
