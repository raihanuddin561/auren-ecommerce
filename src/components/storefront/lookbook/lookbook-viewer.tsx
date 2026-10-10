'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { money } from '@/lib/money';
import { formatPriceText } from '@/lib/price-format';
import type { LookbookDetailItem, HotspotItem } from '@/modules/lookbook/types';

interface LookbookViewerProps {
  lookbook: LookbookDetailItem;
}

export function LookbookViewer({ lookbook }: LookbookViewerProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState<HotspotItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const slides = lookbook.slides;
  const currentSlide = slides[currentSlideIndex];

  const handlePrev = useCallback(() => {
    setActiveHotspot(null);
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
  }, [slides.length]);

  const handleNext = useCallback(() => {
    setActiveHotspot(null);
    setCurrentSlideIndex((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
  }, [slides.length]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') {
        setActiveHotspot(null);
        setIsFullscreen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  if (!currentSlide) {
    return (
      <div className="rounded-xs border border-line bg-page p-12 text-center text-fg-muted">
        <p className="type-body-sm">No editorial frames published in this lookbook yet.</p>
      </div>
    );
  }

  return (
    <div
      className={`relative mx-auto transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-ink p-4 md:p-8'
          : 'w-full'
      }`}
    >
      {/* Top Bar (Fullscreen or Standard) */}
      <div className="mb-4 flex items-center justify-between border-b border-line/40 pb-3">
        <div className="flex items-center gap-3">
          <span className="type-caption font-mono tracking-widest text-accent-text uppercase">
            Frame {currentSlideIndex + 1} of {slides.length}
          </span>
          {currentSlide.title && (
            <span className={`type-title-sm font-serif ${isFullscreen ? 'text-ivory' : 'text-fg'}`}>
              — {currentSlide.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            aria-label={isFullscreen ? 'Exit presentation mode' : 'Enter presentation mode'}
            className={`inline-flex items-center gap-1.5 rounded-xs border border-line px-2.5 py-1 type-caption font-mono transition-colors ${
              isFullscreen
                ? 'border-line/40 text-ivory hover:bg-raised/20'
                : 'text-fg hover:bg-raised'
            }`}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">
              {isFullscreen ? 'Exit Fullscreen' : 'Presentation Mode'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Editorial Canvas with Hotspots */}
      <div className="relative mx-auto flex max-w-5xl flex-1 items-center justify-center">
        <div className="shadow-sm relative aspect-4/5 w-full max-w-2xl overflow-hidden rounded-xs border border-line/60 bg-raised">
          <Image
            src={currentSlide.imageUrl}
            alt={currentSlide.imageAlt || currentSlide.title || 'Lookbook frame'}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover"
          />

          {/* Interactive Shoppable Hotspots */}
          {currentSlide.hotspots.map((hotspot) => {
            const isSelected = activeHotspot?.id === hotspot.id;

            return (
              <div
                key={hotspot.id}
                style={{
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                {/* Pulsing Hotspot Marker */}
                <div className="relative">
                  <span className="absolute -inset-2.5 animate-ping rounded-full bg-accent-text/30 opacity-75" />
                  <button
                    onClick={() => setActiveHotspot(isSelected ? null : hotspot)}
                    onMouseEnter={() => setActiveHotspot(hotspot)}
                    aria-label={`View piece: ${hotspot.label || hotspot.product.title}`}
                    className={`shadow-md relative flex size-8 items-center justify-center rounded-full border transition-all duration-300 ${
                      isSelected
                        ? 'scale-110 border-ivory bg-accent-text text-ivory'
                        : 'border-white/80 bg-ink/80 text-ivory hover:scale-110 hover:bg-accent-text'
                    }`}
                  >
                    <Plus
                      size={15}
                      className={isSelected ? 'rotate-45 transition-transform' : ''}
                    />
                  </button>
                </div>

                {/* Floating Hotspot Product Preview Card */}
                {isSelected && (
                  <div
                    onMouseLeave={() => setActiveHotspot(null)}
                    className="shadow-lg animate-in fade-in zoom-in-95 absolute bottom-11 left-1/2 z-40 w-64 -translate-x-1/2 rounded-xs border border-line bg-page p-3.5 duration-200"
                  >
                    <div className="flex gap-3">
                      {hotspot.product.primaryImage ? (
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-xs bg-raised">
                          <Image
                            src={hotspot.product.primaryImage}
                            alt={hotspot.product.title}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex size-16 shrink-0 items-center justify-center rounded-xs bg-raised text-fg-muted">
                          <ShoppingBag size={20} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <span className="type-caption font-mono text-accent-text uppercase">
                          Featured Piece
                        </span>
                        <h4 className="line-clamp-1 type-body-sm font-medium text-fg">
                          {hotspot.label || hotspot.product.title}
                        </h4>

                        {hotspot.product.material && (
                          <p className="line-clamp-1 type-caption text-fg-muted">
                            {hotspot.product.material}
                          </p>
                        )}

                        <div className="mt-1 flex items-center gap-2">
                          {hotspot.product.priceMinor !== null && (
                            <span className="type-body-sm font-mono font-medium text-fg">
                              {formatPriceText(money(hotspot.product.priceMinor, 'BDT'))}
                            </span>
                          )}
                          {hotspot.product.compareAtMinor && (
                            <span className="type-caption font-mono text-fg-muted line-through">
                              {formatPriceText(money(hotspot.product.compareAtMinor, 'BDT'))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-line/60 pt-2.5">
                      <Link
                        href={`/products/${hotspot.product.slug}`}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xs bg-ink py-1.5 text-center type-caption font-mono text-ivory transition-colors hover:bg-accent-text"
                      >
                        <span>View Piece in Atelier</span>
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Previous / Next Arrows Overlay */}
          <button
            onClick={handlePrev}
            aria-label="Previous frame"
            className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full border border-line/40 bg-ink/60 p-2 text-ivory backdrop-blur-xs transition-colors hover:bg-ink hover:text-accent-text"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNext}
            aria-label="Next frame"
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-line/40 bg-ink/60 p-2 text-ivory backdrop-blur-xs transition-colors hover:bg-ink hover:text-accent-text"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Frame Styling Narrative Caption */}
      {currentSlide.caption && (
        <div className="mx-auto mt-6 max-w-xl text-center">
          <p
            className={`type-body-sm font-serif italic ${
              isFullscreen ? 'text-ivory/80' : 'text-fg-muted'
            }`}
          >
            &ldquo;{currentSlide.caption}&rdquo;
          </p>
        </div>
      )}

      {/* Slide Thumbnails Rail */}
      <div className="mt-8 flex items-center justify-center gap-2 overflow-x-auto pb-2">
        {slides.map((s, idx) => {
          const isCurrent = idx === currentSlideIndex;
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveHotspot(null);
                setCurrentSlideIndex(idx);
              }}
              className={`group relative size-16 shrink-0 overflow-hidden rounded-xs border transition-all ${
                isCurrent
                  ? 'border-accent-text ring-1 ring-accent-text'
                  : 'border-line opacity-60 hover:opacity-100'
              }`}
            >
              <Image
                src={s.imageUrl}
                alt={s.imageAlt || `Frame ${idx + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
              <span className="absolute right-1 bottom-0.5 rounded-xs bg-ink/75 px-1 type-caption font-mono text-ivory">
                {idx + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
