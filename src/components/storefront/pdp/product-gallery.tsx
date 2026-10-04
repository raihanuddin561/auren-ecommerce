'use client';

import { ChevronLeft, ChevronRight, Expand, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import type { PdpImage } from '@/modules/catalog/pdp';
import { CatalogImage, ImagePlaceholder, safeColor } from '../catalog/catalog-image';
import { usePdpState } from './pdp-state';

/** Pictures of the chosen colour first, then the general ones; other colours are left out. */
export function imagesForColor(images: readonly PdpImage[], colorId: string | null): PdpImage[] {
  if (!colorId) return [...images];
  const own = images.filter((image) => image.colorId === colorId);
  const general = images.filter((image) => image.colorId === null);
  const chosen = [...own, ...general];
  // A colour with no pictures of its own still shows the whole set rather than nothing.
  return chosen.length > 0 ? chosen : [...images];
}

interface ProductGalleryProps {
  images: PdpImage[];
  title: string;
}

/**
 * Desktop: the pictures stack and scroll with the page; click opens the lightbox with zoom.
 * Mobile: a swipeable strip with progress dots; tap opens the lightbox (pinch to zoom there).
 * Pictures follow the chosen colour. All motion is instant under prefers-reduced-motion.
 */
export function ProductGallery({ images, title }: ProductGalleryProps) {
  const { colorId } = usePdpState();
  const shown = useMemo(() => imagesForColor(images, colorId), [images, colorId]);
  const [lightbox, setLightboxState] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const setLightbox = useCallback((next: number | null) => {
    if (next !== null) opener.current = document.activeElement as HTMLElement | null;
    setLightboxState(next);
  }, []);
  if (shown.length === 0) {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-sunken">
        <ImagePlaceholder label={title} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <MobileStrip key={colorId ?? 'all'} shown={shown} title={title} onOpen={setLightbox} />

      {/* Desktop stack */}
      <ul className="hidden gap-3 md:grid md:grid-cols-1">
        {shown.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              onClick={() => setLightbox(index)}
              aria-label={`Zoom picture ${index + 1} of ${shown.length}`}
              className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-sunken"
              style={{ backgroundColor: safeColor(image.dominantColor) }}
            >
              <CatalogImage
                src={image.url}
                alt={image.alt}
                sizes="(min-width: 1440px) 560px, 38vw"
                priority={index < 2}
                width={image.width}
                height={image.height}
                blurData={image.blurData}
                className="transition-transform duration-(--dur-reveal) ease-auren group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span className="absolute right-3 bottom-3 inline-flex size-9 items-center justify-center bg-page/85 text-fg opacity-0 transition-auren-fast group-hover:opacity-100 group-focus-visible:opacity-100">
                <Icon icon={Expand} size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Lightbox
        images={shown}
        index={lightbox}
        onIndexChange={setLightbox}
        onClosed={() => opener.current?.focus()}
        title={title}
      />
    </div>
  );
}

/** Swipeable strip for phones. Remounted per colour (key), so a new colour starts at its first picture. */
function MobileStrip({
  shown,
  title,
  onOpen,
}: {
  shown: PdpImage[];
  title: string;
  onOpen: (index: number) => void;
}) {
  const [active, setActive] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const onScroll = useCallback(() => {
    const element = strip.current;
    if (!element || element.clientWidth === 0) return;
    setActive(Math.round(element.scrollLeft / element.clientWidth));
  }, []);
  return (
    <div className="relative md:hidden">
      <div
        ref={strip}
        onScroll={onScroll}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${title} pictures`}
        tabIndex={0}
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto scroll-smooth [-ms-overflow-style:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => onOpen(index)}
            aria-label={`Open picture ${index + 1} of ${shown.length} full screen`}
            className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden bg-sunken"
            style={{ backgroundColor: safeColor(image.dominantColor) }}
          >
            <CatalogImage
              src={image.url}
              alt={image.alt}
              sizes="100vw"
              priority={index === 0}
              width={image.width}
              height={image.height}
              blurData={image.blurData}
            />
          </button>
        ))}
      </div>
      {shown.length > 1 ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" role="status">
          <span className="sr-only">{`Picture ${active + 1} of ${shown.length}`}</span>
          {shown.map((image, index) => (
            <span
              key={image.id}
              aria-hidden="true"
              className={cn(
                'h-0.5 w-6 transition-auren-fast',
                index === active ? 'bg-fg' : 'bg-fg/30',
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Lightbox({
  images,
  index,
  onIndexChange,
  onClosed,
  title,
}: {
  images: PdpImage[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onClosed: () => void;
  title: string;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const touchStart = useRef<number | null>(null);
  const open = index !== null;

  const step = useCallback(
    (delta: number) => {
      if (index === null) return;
      setZoomed(false);
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  const image = index === null ? null : images[index];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setZoomed(false);
        onIndexChange(null);
      }}
    >
      <DialogContent
        hideClose
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
        className="top-0 left-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-page p-0 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in md:p-0"
      >
        <DialogTitle className="sr-only">{title} pictures</DialogTitle>
        <DialogDescription className="sr-only">
          Picture {index === null ? 0 : index + 1} of {images.length}. Use the arrow keys to move
          between pictures.
        </DialogDescription>
        <div
          className="relative flex h-dvh items-center justify-center overflow-hidden"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX;
            touchStart.current = null;
            // A swipe moves between pictures; with two fingers the browser pinch-zooms instead.
            if (zoomed || start === null || end === undefined || event.touches.length > 0) return;
            if (Math.abs(end - start) > 60) step(end < start ? 1 : -1);
          }}
        >
          {image ? (
            <button
              type="button"
              aria-label="Zoom picture"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setOrigin(
                  `${((event.clientX - rect.left) / rect.width) * 100}% ${((event.clientY - rect.top) / rect.height) * 100}%`,
                );
                setZoomed((value) => !value);
              }}
              onMouseMove={(event) => {
                if (!zoomed) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setOrigin(
                  `${((event.clientX - rect.left) / rect.width) * 100}% ${((event.clientY - rect.top) / rect.height) * 100}%`,
                );
              }}
              className={cn(
                'relative aspect-[4/5] h-full max-h-dvh touch-pinch-zoom overflow-hidden bg-sunken',
                zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in',
              )}
              style={{ maxWidth: '80dvh' }}
            >
              <span
                className="absolute inset-0 block transition-transform duration-(--dur-slow) ease-auren motion-reduce:transition-none"
                style={{ transform: zoomed ? 'scale(2.2)' : 'scale(1)', transformOrigin: origin }}
              >
                <CatalogImage
                  src={image.url}
                  alt={image.alt}
                  sizes="100vw"
                  priority
                  width={image.width}
                  height={image.height}
                  blurData={image.blurData}
                />
              </span>
            </button>
          ) : null}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={() => setZoomed((value) => !value)}
              aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
              className="touch-target inline-flex size-11 items-center justify-center bg-page/90 text-fg"
            >
              <Icon icon={zoomed ? ZoomOut : ZoomIn} size={20} />
            </button>
            <DialogClose
              aria-label="Close pictures"
              className="touch-target inline-flex size-11 items-center justify-center bg-page/90 text-fg"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ×
              </span>
            </DialogClose>
          </div>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous picture"
                className="touch-target absolute top-1/2 left-4 inline-flex size-11 -translate-y-1/2 items-center justify-center bg-page/90 text-fg"
              >
                <Icon icon={ChevronLeft} size={22} />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next picture"
                className="touch-target absolute top-1/2 right-4 inline-flex size-11 -translate-y-1/2 items-center justify-center bg-page/90 text-fg"
              >
                <Icon icon={ChevronRight} size={22} />
              </button>
              <p
                role="status"
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-page/90 px-3 py-1 type-small text-fg"
              >
                {(index ?? 0) + 1} / {images.length}
              </p>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
