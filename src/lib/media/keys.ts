import { randomBytes } from 'node:crypto';

export const PRIVATE_PREFIX = 'private/';

const SEGMENT = /^[a-z0-9][a-z0-9-]{0,40}$/;
const IMAGE_EXTENSIONS = new Set(['jpg', 'png', 'webp', 'avif']);
const EXTENSIONS = new Set(['jpg', 'png', 'webp', 'avif', 'pdf']);

/**
 * Random, unguessable storage key such as `products/4f9k...Qw.webp`. The scope is a fixed string
 * chosen by the caller (`products`, `receipts`), never user input, and the file name is random:
 * a client supplied name is never part of a key.
 */
export function newMediaKey(scope: string, extension: string, isPrivate = false): string {
  if (!SEGMENT.test(scope) || scope === 'private')
    throw new Error(`invalid media scope "${scope}"`);
  if (!EXTENSIONS.has(extension)) throw new Error(`invalid media extension "${extension}"`);
  if (!isPrivate && !IMAGE_EXTENSIONS.has(extension))
    throw new Error('public media must be an image');
  const name = randomBytes(24).toString('base64url');
  return `${isPrivate ? PRIVATE_PREFIX : ''}${scope}/${name}.${extension}`;
}

export const isPrivateKey = (key: string): boolean => key.startsWith(PRIVATE_PREFIX);

/** Keys we produce: lowercase scope, a base64url name and a known extension. Anything else is refused. */
const KEY_SHAPE =
  /^(?:private\/)?[a-z0-9][a-z0-9-]{0,40}\/[A-Za-z0-9_-]{20,64}\.(?:jpg|png|webp|avif|pdf)$/;

export const isValidMediaKey = (key: string): boolean => KEY_SHAPE.test(key);

/** Public keys are images only: a pdf is never served from a public URL. */
export const isPublicImageKey = (key: string): boolean =>
  isValidMediaKey(key) && !isPrivateKey(key) && !key.endsWith('.pdf');
