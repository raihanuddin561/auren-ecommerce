import Image from 'next/image';
import { cn } from '@/lib/cn';

/** A same-origin path (placeholders under /seed, uploads under /api/media). Anything else is remote. */
export const isLocalImage = (src: string): boolean => src.startsWith('/') && !src.startsWith('//');

/** A stored preview is only used when it really is an inline image. */
const isBlurData = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^data:image\/(png|jpe?g|webp|avif);base64,/i.test(value);

/** A stored dominant colour is only used when it is a plain hex value. */
export const safeColor = (value: string | null | undefined): string | undefined =>
  typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : undefined;

interface CatalogImageProps {
  src: string;
  /** Required. Use an empty string only when the image repeats text beside it. */
  alt: string;
  sizes: string;
  /** Set on the first image above the fold only. */
  priority?: boolean;
  width?: number | null;
  height?: number | null;
  /** Tiny stored preview shown while the picture loads. */
  blurData?: string | null;
  /** Called when the picture cannot be loaded, so the caller can show a calm stand-in. */
  onError?: () => void;
  className?: string;
}

/**
 * Fills its parent (which must be positioned and have a fixed aspect ratio, so nothing shifts).
 * Same-origin images go through next/image; a remote address, which next/image would refuse
 * without an allow list, is shown as a plain image with its natural size attributes.
 */
export function CatalogImage({
  src,
  alt,
  sizes,
  priority = false,
  width,
  height,
  blurData,
  onError,
  className,
}: CatalogImageProps) {
  if (isLocalImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onError={onError}
        {...(isBlurData(blurData) ? { placeholder: 'blur' as const, blurDataURL: blurData } : {})}
        className={cn('object-cover', className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote address that next/image is not configured for
    <img
      src={src}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={onError}
      className={cn('absolute inset-0 size-full object-cover', className)}
    />
  );
}

/** Calm stand-in when a product, category or collection has no image yet. */
export function ImagePlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-sunken px-4 text-center',
        className,
      )}
    >
      <span className="line-clamp-3 type-h2 text-fg-muted">{label}</span>
    </div>
  );
}
