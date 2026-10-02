import Image from 'next/image';
import { cn } from '@/lib/cn';
import { viewTransitionName } from '@/lib/motion';

const RATIOS = {
  /** Product imagery is always 4:5. */
  product: 'aspect-4/5',
  editorial: 'aspect-video',
  portrait: 'aspect-9/16',
  square: 'aspect-square',
} as const;

interface ImageFrameProps {
  src: string;
  /** Required: describe the product or scene. Use an empty string only for purely decorative art. */
  alt: string;
  /** Responsive sizes hint, for example `(min-width: 1024px) 25vw, 50vw`. */
  sizes: string;
  ratio?: keyof typeof RATIOS;
  /** Set on the LCP image only. */
  priority?: boolean;
  /** Second image that crossfades in on hover (hover-capable devices only). */
  hoverSrc?: string;
  hoverAlt?: string;
  /** Slow 1.04 zoom on hover. Defaults to on when there is no second image. */
  zoom?: boolean;
  /** Shared-element id so a card image can morph into the product gallery. */
  transitionId?: string;
  className?: string;
}

/**
 * Fixed-ratio media frame: no layout shift, calm hover, consistent crops. It is a group, so card
 * hover and keyboard focus inside the card drive the same effect.
 */
export function ImageFrame({
  src,
  alt,
  sizes,
  ratio = 'product',
  priority = false,
  hoverSrc,
  hoverAlt = '',
  zoom,
  transitionId,
  className,
}: ImageFrameProps) {
  const zoomed = zoom ?? !hoverSrc;
  return (
    <div
      className={cn('group relative overflow-hidden bg-sunken', RATIOS[ratio], className)}
      style={
        transitionId ? { viewTransitionName: viewTransitionName('image', transitionId) } : undefined
      }
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn('object-cover', zoomed && 'img-zoom')}
      />
      {hoverSrc ? (
        <Image src={hoverSrc} alt={hoverAlt} fill sizes={sizes} className="object-cover img-swap" />
      ) : null}
    </div>
  );
}
