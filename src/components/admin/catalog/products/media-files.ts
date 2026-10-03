import { MAX_MEDIA_PER_PRODUCT } from '@/modules/catalog/schemas';

export { MAX_MEDIA_PER_PRODUCT };

/** Mirrors MAX_IMAGE_BYTES on the server (that module cannot be loaded in the browser). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** SVG is never accepted: it can carry script. The server decides by file content, this is a courtesy. */
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',');

const EXTENSION_TYPES: Record<string, (typeof ACCEPTED_TYPES)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

interface FileLike {
  name: string;
  type: string;
  size: number;
}

const extensionOf = (name: string): string => name.split('.').pop()?.toLowerCase() ?? '';

/** A reason the file cannot be uploaded, or null when it looks fine. */
export function validateImageFile(file: FileLike): string | null {
  const extension = extensionOf(file.name);
  if (file.type === 'image/svg+xml' || extension === 'svg') {
    return 'SVG files are not accepted. Use JPEG, PNG, WebP or AVIF.';
  }
  // Some browsers leave the type empty for newer formats: fall back to the extension.
  const type = file.type || EXTENSION_TYPES[extension] || '';
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) {
    return 'Use a JPEG, PNG, WebP or AVIF image.';
  }
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'The image is larger than 10 MB.';
  return null;
}

export interface FileSelection<T extends FileLike> {
  accepted: T[];
  rejected: Array<{ name: string; reason: string }>;
}

/** Splits chosen files into those that fit (type, size, and the room left) and those that do not. */
export function selectFiles<T extends FileLike>(
  files: readonly T[],
  existingCount: number,
  pendingCount: number,
): FileSelection<T> {
  const accepted: T[] = [];
  const rejected: FileSelection<T>['rejected'] = [];
  let room = Math.max(0, MAX_MEDIA_PER_PRODUCT - existingCount - pendingCount);
  for (const file of files) {
    const problem = validateImageFile(file);
    if (problem) rejected.push({ name: file.name, reason: problem });
    else if (room === 0) {
      rejected.push({
        name: file.name,
        reason: `A product can have ${MAX_MEDIA_PER_PRODUCT} images.`,
      });
    } else {
      accepted.push(file);
      room -= 1;
    }
  }
  return { accepted, rejected };
}

export type PendingState = 'ready' | 'uploading' | 'done' | 'error';

export interface PendingLike {
  alt: string;
  state: PendingState;
}

/** The Upload button needs at least one file, alt text on every file, and nothing in flight. */
export function canUpload(pending: readonly PendingLike[]): boolean {
  const waiting = pending.filter((p) => p.state === 'ready' || p.state === 'error');
  return (
    waiting.length > 0 &&
    pending.every((p) => p.state !== 'uploading') &&
    waiting.every((p) => p.alt.trim().length > 0)
  );
}
