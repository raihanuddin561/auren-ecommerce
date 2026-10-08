'use client';

import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ShieldCheck,
  Truck,
  RefreshCw,
} from 'lucide-react';
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
 * Meets AUREN's editorial menswear aesthetic:
 * - Compatible with all image aspect ratios (portrait garments, square pieces, panoramic campaigns).
 * - "contain" (default): features garments uncropped in an atelier gallery pedestal frame with ambient reflection.
 * - "cover": full-bleed panoramic campaign photography.
 * - Touch swipe gestures, keyboard navigation, animated progress bar, and full accessibility.
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
        'group relative flex min-h-[calc(100svh-var(--header-height))] w-full flex-col justify-between overflow-hidden bg-page pt-(--header-height) text-fg outline-none select-none focus-visible:ring-1 focus-visible:ring-gold/60',
        className,
      )}
    >
      {/* Background ambient container */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-page">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const isBroken = Boolean(brokenImages[slide.id || index]);
          const isCover = slide.imageFit === 'cover';
          const overlayPct = (slide.overlayOpacity ?? 25) / 100;

          return (
            <div
              key={`bg-${slide.id || index}`}
              aria-hidden={!isActive}
              className={cn(
                'absolute inset-0 transition-opacity duration-1000 ease-out',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
            >
              {isCover ? (
                // Full-bleed mode: panoramic backdrop
                <div className="absolute inset-0">
                  {!isBroken && slide.imageUrl ? (
                    <CatalogImage
                      src={slide.imageUrl}
                      alt=""
                      sizes="100vw"
                      priority={index === 0}
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, [slide.id || index]: true }))
                      }
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="via-neutral-900 size-full bg-gradient-to-br from-stone-900 to-ink" />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: `rgba(15, 15, 15, ${overlayPct})` }}
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-page via-page/40 to-transparent"
                  />
                </div>
              ) : (
                // Showcase mode: ambient luminous reflection behind the pedestal
                <div className="absolute inset-0">
                  {!isBroken && slide.imageUrl ? (
                    <div className="absolute inset-0 scale-125 opacity-25 blur-3xl transition-opacity duration-1000">
                      <CatalogImage
                        src={slide.imageUrl}
                        alt=""
                        sizes="100vw"
                        className="size-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="absolute inset-0 bg-radial from-stone-900/40 via-page/80 to-page" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Slide Content Stage */}
      <div className="relative z-10 container-page flex flex-1 flex-col justify-center py-8 md:py-12">
        <div className="grid w-full items-center">
          {slides.map((slide, index) => {
            const isActive = index === currentIndex;
            const isBroken = Boolean(brokenImages[slide.id || index]);
            const isCover = slide.imageFit === 'cover';

            return (
              <div
                key={`slide-${slide.id || index}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${index + 1} of ${total}: ${slide.title}`}
                aria-hidden={!isActive}
                className={cn(
                  'col-start-1 row-start-1 transition-all duration-700 ease-out',
                  isActive
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none translate-y-4 opacity-0',
                )}
              >
                {isCover ? (
                  // Full-Bleed Layout
                  <div className="flex max-w-4xl flex-col items-start pb-16 text-left md:pb-20">
                    {slide.eyebrow ? (
                      <p className="type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase">
                        {slide.eyebrow}
                      </p>
                    ) : null}

                    <h1 className="mt-4 type-display-xl font-display leading-[1.02] tracking-tight text-fg">
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
                ) : (
                  // Editorial Showcase Split Layout (Default for Products - Full Uncropped View)
                  <div className="grid items-center gap-8 pb-8 md:pb-12 lg:grid-cols-12 lg:gap-14">
                    {/* Left Column: Editorial Messaging */}
                    <div className="order-2 flex flex-col justify-center text-left lg:order-1 lg:col-span-6">
                      {slide.eyebrow ? (
                        <p className="type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase">
                          {slide.eyebrow}
                        </p>
                      ) : null}

                      <h1 className="mt-3 type-display-xl font-display leading-[1.04] tracking-tight text-fg lg:text-[3.25rem]">
                        {slide.title}
                      </h1>

                      {slide.description ? (
                        <p className="mt-4 max-w-xl type-body leading-relaxed text-pretty text-fg-muted">
                          {slide.description}
                        </p>
                      ) : null}

                      {/* CTA Buttons */}
                      <div className="mt-7 flex flex-wrap items-center gap-3.5 md:mt-9">
                        {slide.primaryCtaText && slide.primaryCtaLink ? (
                          <Button asChild variant="primary" size="lg" className="tracking-button">
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
                            className="border border-line-strong hover:border-fg"
                          >
                            <Link href={slide.secondaryCtaLink} tabIndex={isActive ? 0 : -1}>
                              {slide.secondaryCtaText}
                            </Link>
                          </Button>
                        ) : null}
                      </div>

                      {/* Reassurance pills */}
                      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line/40 pt-4 type-small text-fg-muted">
                        <span className="inline-flex items-center gap-1.5 text-fg/90">
                          <Icon icon={Truck} size={15} className="text-accent-text" />
                          <span>All 64 Districts COD</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1.5 text-fg/90">
                          <Icon icon={ShieldCheck} size={15} className="text-accent-text" />
                          <span>Doorstep Inspection</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1.5 text-fg/90">
                          <Icon icon={RefreshCw} size={15} className="text-accent-text" />
                          <span>7-Day Fit Exchange</span>
                        </span>
                      </div>
                    </div>

                    {/* Right Column: Full-View Uncropped Atelier Pedestal Frame */}
                    <div className="order-1 flex items-center justify-center lg:order-2 lg:col-span-6">
                      <div className="group/frame bg-surface-raised/40 hover:shadow-2xl relative mx-auto flex aspect-[4/5] w-full max-w-[360px] items-center justify-center overflow-hidden rounded-xs border border-line/80 p-4 shadow-float backdrop-blur-xs transition-all duration-500 hover:border-gold/70 sm:max-w-[420px] sm:p-6 lg:max-w-[480px]">
                        {!isBroken && slide.imageUrl ? (
                          <CatalogImage
                            src={slide.imageUrl}
                            alt={slide.imageAlt || slide.title}
                            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 420px, 480px"
                            priority={index === 0}
                            onError={() =>
                              setBrokenImages((prev) => ({ ...prev, [slide.id || index]: true }))
                            }
                            className="size-full object-contain transition-transform duration-700 ease-auren group-hover/frame:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center bg-sunken p-6 text-center type-small text-fg-muted">
                            Photography unavailable
                          </div>
                        )}

                        {/* Floating Atelier Badge */}
                        <div className="absolute top-3.5 right-3.5 rounded-xs border border-line/80 bg-page/90 px-2 py-0.5 text-[10px] font-medium tracking-wider text-accent-text uppercase backdrop-blur-xs">
                          Auren Atelier
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom controls: Slide indicator bars, numbering & arrows */}
      {total > 1 ? (
        <div className="relative z-20 container-page pb-6 md:pb-10">
          <div className="flex flex-col gap-4 border-t border-line/40 pt-5 sm:flex-row sm:items-center sm:justify-between">
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
      aria-hidden="true"
      className="relative flex min-h-[calc(100svh-var(--header-height))] w-full animate-pulse flex-col justify-center bg-page pt-(--header-height) text-fg"
    >
      <div className="container-page grid items-center gap-8 py-12 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-6">
          <div className="h-4 w-32 rounded-xs bg-line/60" />
          <div className="h-14 w-3/4 rounded-xs bg-line/80" />
          <div className="h-20 w-full max-w-lg rounded-xs bg-line/40" />
          <div className="flex gap-4 pt-4">
            <div className="h-12 w-40 rounded-xs bg-line" />
            <div className="h-12 w-32 rounded-xs bg-line/50" />
          </div>
        </div>
        <div className="flex justify-center lg:col-span-6">
          <div className="aspect-[4/5] w-full max-w-[440px] rounded-xs bg-line/40" />
        </div>
      </div>
    </section>
  );
}
