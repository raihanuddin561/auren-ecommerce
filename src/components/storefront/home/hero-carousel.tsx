'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/components/motion/use-reduced-motion';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import type { HeroCarouselSettings, HeroSlide } from '@/modules/settings/schemas';
import { CatalogImage } from '../catalog/catalog-image';

interface HeroCarouselProps {
  settings: HeroCarouselSettings;
  className?: string;
}

/**
 * Modern, luxury storefront hero carousel.
 * Meets AUREN's editorial menswear aesthetic: fluid slide transitions, touch swipe support,
 * animated progress bar, responsive layouts, keyboard navigation, and full accessibility.
 */
export function HeroCarousel({ settings, className }: HeroCarouselProps) {
  const slides: HeroSlide[] = settings.slides.length > 0 ? settings.slides : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(settings.autoplay && slides.length > 1);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const total = slides.length;
  const activeSlide = slides[currentIndex] ?? slides[0];

  const goTo = useCallback(
    (index: number) => {
      if (total <= 1) return;
      setCurrentIndex((index + total) % total);
    },
    [total],
  );

  const next = useCallback(() => {
    goTo(currentIndex + 1);
  }, [currentIndex, goTo]);

  const prev = useCallback(() => {
    goTo(currentIndex - 1);
  }, [currentIndex, goTo]);

  // Autoplay timer
  useEffect(() => {
    if (!isPlaying || isHovered || prefersReducedMotion || total <= 1) return;

    const timer = setInterval(() => {
      goTo(currentIndex + 1);
    }, settings.autoplayInterval);

    return () => clearInterval(timer);
  }, [
    currentIndex,
    goTo,
    isHovered,
    isPlaying,
    prefersReducedMotion,
    settings.autoplayInterval,
    total,
  ]);

  // Touch gesture handling
  function handleTouchStart(e: React.TouchEvent) {
    if (total <= 1) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null || touchStartYRef.current === null || total <= 1) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    // Only swipe if horizontal distance dominates vertical scroll
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        next();
      } else {
        prev();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (total <= 1) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    }
  }

  if (slides.length === 0 || !activeSlide) {
    return null;
  }

  return (
    <section
      data-tone="ink"
      aria-roledescription="carousel"
      aria-label="Campaign highlights"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'group relative flex min-h-svh w-full flex-col justify-end overflow-hidden bg-page pt-(--header-height) text-fg outline-none select-none focus-visible:ring-1 focus-visible:ring-gold/60',
        className,
      )}
    >
      {/* Slides container */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const overlayPct = (slide.overlayOpacity ?? 25) / 100;
          const isBroken = Boolean(brokenImages[slide.id || index]);

          return (
            <div
              key={slide.id || index}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${total}: ${slide.title}`}
              aria-hidden={!isActive}
              className={cn(
                'absolute inset-0 transition-opacity duration-1000 ease-out',
                isActive ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
            >
              {/* Background photography */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-10000 ease-out',
                  isActive && !prefersReducedMotion ? 'scale-100' : 'scale-105',
                )}
              >
                {!isBroken && slide.imageUrl ? (
                  <CatalogImage
                    src={slide.imageUrl}
                    alt={slide.imageAlt || slide.title}
                    sizes="100vw"
                    priority={index === 0}
                    onError={() =>
                      setBrokenImages((prev) => ({ ...prev, [slide.id || index]: true }))
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="via-neutral-900 h-full w-full bg-gradient-to-br from-stone-800 to-ink" />
                )}
              </div>

              {/* Scrim and dark contrast overlays */}
              <div
                className="absolute inset-0"
                style={{ backgroundColor: `rgba(15, 15, 15, ${overlayPct})` }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/20 to-transparent"
              />
            </div>
          );
        })}
      </div>

      {/* Slide editorial content */}
      <div className="relative z-10 container-page grid min-h-[calc(100svh-var(--header-height))] items-end pb-24 md:pb-32">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const alignClass =
            slide.textAlignment === 'center'
              ? 'items-center text-center mx-auto'
              : slide.textAlignment === 'right'
                ? 'items-end text-right ml-auto'
                : 'items-start text-left';

          return (
            <div
              key={`content-${slide.id || index}`}
              className={cn(
                'col-start-1 row-start-1 flex flex-col transition-all duration-700 ease-out',
                alignClass,
                isActive
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-4 opacity-0',
              )}
            >
              {slide.eyebrow ? (
                <p className="type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase">
                  {slide.eyebrow}
                </p>
              ) : null}

              <h1 className="mt-4 max-w-4xl type-display-xl font-display leading-[1.02] font-normal tracking-[-0.02em] text-fg">
                {slide.title}
              </h1>

              {slide.description ? (
                <p className="mt-5 max-w-xl type-body text-pretty text-fg-muted">
                  {slide.description}
                </p>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-4 md:mt-10">
                {slide.primaryCtaText && slide.primaryCtaLink ? (
                  <Button asChild variant="primary" size="lg">
                    <Link href={slide.primaryCtaLink} tabIndex={isActive ? 0 : -1}>
                      {slide.primaryCtaText}
                    </Link>
                  </Button>
                ) : null}

                {slide.secondaryCtaText && slide.secondaryCtaLink ? (
                  <Button
                    asChild
                    variant="secondary"
                    size="lg"
                    className="border border-line/70 bg-ink/30 text-fg backdrop-blur-xs hover:border-fg hover:bg-fg/10"
                  >
                    <Link href={slide.secondaryCtaLink} tabIndex={isActive ? 0 : -1}>
                      {slide.secondaryCtaText}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom controls: Slide indicator bars, numbering & arrows */}
      {total > 1 ? (
        <div className="relative z-20 container-page pb-8 md:pb-12">
          <div className="flex flex-col gap-4 border-t border-line/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
            {/* Interactive slide progress bars & numbers */}
            <div role="tablist" aria-label="Slides" className="flex items-center gap-2 sm:gap-3">
              {slides.map((slide, index) => {
                const isActive = index === currentIndex;
                const paddedIndex = String(index + 1).padStart(2, '0');

                return (
                  <button
                    key={`indicator-${slide.id || index}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                    onClick={() => goTo(index)}
                    className="group/ind flex items-center gap-2 py-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
                  >
                    <span
                      className={cn(
                        'type-small font-mono transition-colors duration-200',
                        isActive ? 'font-medium text-fg' : 'text-fg-muted group-hover/ind:text-fg',
                      )}
                    >
                      {paddedIndex}
                    </span>
                    <div className="relative h-0.5 w-10 overflow-hidden bg-line/40 transition-colors duration-200 sm:w-16">
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 bg-gold transition-all',
                          isActive
                            ? 'w-full'
                            : 'w-0 group-hover/ind:w-1/3 group-hover/ind:bg-fg-muted',
                        )}
                        style={
                          isActive && isPlaying && !isHovered && !prefersReducedMotion
                            ? {
                                transitionDuration: `${settings.autoplayInterval}ms`,
                                transitionTimingFunction: 'linear',
                              }
                            : undefined
                        }
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Play/pause toggle and Next / Prev buttons */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              {/* Autoplay toggle */}
              <button
                type="button"
                onClick={() => setIsPlaying((prev) => !prev)}
                aria-label={isPlaying ? 'Pause carousel autoplay' : 'Start carousel autoplay'}
                className="flex size-9 items-center justify-center border border-line/40 bg-ink/40 text-fg-muted backdrop-blur-xs transition-colors duration-150 hover:border-fg hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
              >
                <Icon icon={isPlaying ? Pause : Play} size={16} aria-hidden />
              </button>

              {/* Prev slide button */}
              <button
                type="button"
                onClick={prev}
                aria-label="Previous slide"
                className="flex size-9 items-center justify-center border border-line/40 bg-ink/40 text-fg-muted backdrop-blur-xs transition-colors duration-150 hover:border-fg hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
              >
                <Icon icon={ChevronLeft} size={16} aria-hidden />
              </button>

              {/* Next slide button */}
              <button
                type="button"
                onClick={next}
                aria-label="Next slide"
                className="flex size-9 items-center justify-center border border-line/40 bg-ink/40 text-fg-muted backdrop-blur-xs transition-colors duration-150 hover:border-fg hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
              >
                <Icon icon={ChevronRight} size={16} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Fallback skeleton while hero carousel data resolves. */
export function HeroCarouselSkeleton() {
  return (
    <section
      data-tone="ink"
      className="relative flex min-h-svh w-full flex-col justify-end overflow-hidden bg-page pt-(--header-height) text-fg"
    >
      <div className="relative z-10 container-page flex min-h-[calc(100svh-var(--header-height))] flex-col justify-end pb-24 md:pb-32">
        <div className="h-4 w-28 animate-pulse bg-line/20" />
        <div className="mt-5 h-16 w-3/4 max-w-2xl animate-pulse bg-line/20" />
        <div className="mt-6 h-6 w-1/2 max-w-lg animate-pulse bg-line/20" />
        <div className="mt-10 h-12 w-48 animate-pulse bg-line/30" />
      </div>
    </section>
  );
}
