import sharp from 'sharp';

/**
 * Upload validation (ADR-026). The type is decided by the file's own magic bytes, never by the
 * client's file name or Content-Type. SVG (and any other XML or HTML) is refused outright: it can
 * carry script. Images are then re-encoded, which drops EXIF, GPS and any trailing payload.
 */
/**
 * A receipt may also be a PDF. Receipt files are stored as received (only product images are
 * re-encoded): they stay private and are delivered as attachments with a sandbox CSP.
 * The upload route that calls this must also cap the request body before buffering it.
 */
export type UploadKind = 'image' | 'receipt';

export interface SniffedType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'application/pdf';
  extension: 'jpg' | 'png' | 'webp' | 'avif' | 'pdf';
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
/** Decompression bomb guard: a 50 megapixel image is already larger than any product photo. */
export const MAX_INPUT_PIXELS = 50_000_000;
const MAX_EDGE = 2400;

const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, end));

export function sniffMedia(bytes: Uint8Array): SniffedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
  ) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  if (bytes.length >= 16 && ascii(bytes, 4, 8) === 'ftyp') {
    const brands = [ascii(bytes, 8, 12), ...[16, 20, 24, 28].map((o) => ascii(bytes, o, o + 4))];
    if (brands.some((b) => b === 'avif' || b === 'avis')) {
      return { mime: 'image/avif', extension: 'avif' };
    }
  }
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') {
    return { mime: 'application/pdf', extension: 'pdf' };
  }
  return null;
}

export type UploadCheck =
  | { ok: true; type: SniffedType; size: number }
  | { ok: false; code: 'empty' | 'too_large' | 'unsupported_type'; message: string };

export interface UploadRules {
  kind: UploadKind;
  /** Override the default size cap (never above 25 MB). */
  maxBytes?: number;
}

export function validateUpload(bytes: Uint8Array, rules: UploadRules): UploadCheck {
  const requested =
    rules.maxBytes ?? (rules.kind === 'image' ? MAX_IMAGE_BYTES : MAX_RECEIPT_BYTES);
  if (!Number.isFinite(requested) || requested <= 0) throw new Error('invalid upload size cap');
  const limit = Math.min(requested, 25 * 1024 * 1024);
  if (bytes.length === 0) return { ok: false, code: 'empty', message: 'The file is empty.' };
  if (bytes.length > limit) {
    return {
      ok: false,
      code: 'too_large',
      message: `The file is larger than ${Math.floor(limit / (1024 * 1024))} MB.`,
    };
  }
  const type = sniffMedia(bytes);
  const allowed = type && (rules.kind === 'receipt' || type.mime !== 'application/pdf');
  if (!type || !allowed) {
    return {
      ok: false,
      code: 'unsupported_type',
      message:
        rules.kind === 'image'
          ? 'Use a JPEG, PNG, WebP or AVIF image.'
          : 'Use a PDF, JPEG, PNG, WebP or AVIF file.',
    };
  }
  return { ok: true, type, size: bytes.length };
}

export interface ProcessedImage {
  body: Buffer;
  mime: 'image/webp';
  extension: 'webp';
  width: number;
  height: number;
  /** Dominant colour as #rrggbb, for placeholders. */
  dominantColor: string;
  /** Tiny WebP data URL for blur-up placeholders (product_media.blur_data). */
  blurData: string;
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/**
 * Re-encodes an image that passed validateUpload: applies the EXIF orientation, then writes a
 * fresh WebP without any metadata (no EXIF, GPS, ICC comments or trailing data), capped at 2400 px
 * on the long edge.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const { dominant } = await sharp(data).stats();
  const blur = await sharp(data)
    .resize({ width: 12, height: 12, fit: 'inside' })
    .webp({ quality: 40 })
    .toBuffer();
  return {
    body: data,
    mime: 'image/webp',
    extension: 'webp',
    width: info.width,
    height: info.height,
    dominantColor: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
    blurData: `data:image/webp;base64,${blur.toString('base64')}`,
  };
}
