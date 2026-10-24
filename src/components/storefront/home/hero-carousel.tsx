'use client';

import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Truck,
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
 * - Dynamically detects natural image dimensions to ensure optimal framing with zero awkward crops.
 * - "contain" (default): features garments uncropped in an atelier gallery pedestal frame with ambient reflection.
 * - "cover": full-bleed panoramic campaign photography with dynamic portrait/landscape focal alignment.
 * - Selective hover pause: Slider only pauses when the image frame or action buttons are hovered.
 * - Smooth synchronized animated progress bars, touch swipe gestures, and full accessibility.
 */
export function HeroCarousel({ settings, className }: HeroCarouselProps) {
  const slides: HeroSlide[] = settings.slides.length > 0 ? settings.slides : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(settings.autoplay && slides.length > 1);
  const [isHovered, setIsHovered] = useState(false);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
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

  const handlePause = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleResume = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleImageLoad = useCallback(
    (slideKey: string, e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        setImageRatios((prev) => ({ ...prev, [slideKey]: ratio }));
      }
    },
    [],
  );

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
      onMouseLeave={handleResume}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'group relative flex w-full flex-col justify-between overflow-hidden bg-page pt-(--header-height) text-fg outline-none select-none focus-visible:ring-1 focus-visible:ring-gold/60',
        'min-h-[560px] md:min-h-[600px] lg:min-h-[660px]',
        className,
      )}
    >
      {/* Background ambient container: luminous reflection and subtle vignette */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-page">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const isBroken = Boolean(brokenImages[slide.id || index]);

          return (
            <div
              key={`bg-${slide.id || index}`}
              aria-hidden={!isActive}
              className={cn(
                'absolute inset-0 transition-opacity duration-1000 ease-out',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
            >
              {!isBroken && slide.imageUrl ? (
                <div className="absolute inset-0 scale-125 opacity-20 blur-3xl transition-opacity duration-1000">
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
          );
        })}
      </div>

      {/* Main Slide Content Stage - Unified Stable Architecture Across All Slides */}
      <div className="relative z-10 container-page flex flex-1 flex-col justify-center py-6 md:py-8 lg:py-10">
        <div className="grid w-full items-center gap-8 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Stacked Editorial Storytelling */}
          <div className="order-2 flex flex-col justify-center text-left lg:order-1 lg:col-span-6 xl:col-span-7">
            <div className="grid w-full">
              {slides.map((slide, index) => {
                const isActive = index === currentIndex;

                return (
                  <div
                    key={`text-${slide.id || index}`}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`Slide ${index + 1} of ${total}: ${slide.title}`}
                    aria-hidden={!isActive}
                    className={cn(
                      'col-start-1 row-start-1 flex flex-col justify-center transition-all duration-700 ease-out',
                      isActive
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none translate-y-3 opacity-0',
                    )}
                  >
                    {slide.eyebrow ? (
                      <p
                        className={cn(
                          'flex items-center gap-2.5 type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase transition-all duration-500',
                          isActive ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                        )}
                      >
                        <span className="inline-block h-px w-5 bg-gold/70" />
                        <span>{slide.eyebrow}</span>
                      </p>
                    ) : null}

                    <h1
                      className={cn(
                        'mt-3.5 type-display-xl font-display leading-[1.04] tracking-tight text-balance text-fg transition-all delay-75 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
                        isActive ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                      )}
                    >
                      {slide.title}
                    </h1>

                    {slide.description ? (
                      <p
                        className={cn(
                          'mt-4 max-w-xl type-body leading-relaxed text-pretty text-fg-muted/95 transition-all delay-150 duration-700 ease-out',
                          isActive ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                        )}
                      >
                        {slide.description}
                      </p>
                    ) : null}

                    {/* Action CTAs - Pauses on Hover */}
                    <div
                      data-carousel-buttons
                      onMouseEnter={handlePause}
                      onMouseLeave={handleResume}
                      className={cn(
                        'mt-6 flex w-fit flex-wrap items-center gap-3.5 transition-all delay-200 duration-700 ease-out md:mt-8',
                        isActive
                          ? 'translate-y-0 opacity-100'
                          : 'pointer-events-none translate-y-3 opacity-0',
                      )}
                    >
                      {slide.primaryCtaText && slide.primaryCtaLink ? (
                        <Button
                          asChild
                          variant="primary"
                          size="lg"
                          className="shadow-sm tracking-button transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                          onFocus={handlePause}
                          onBlur={handleResume}
                        >
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
                          className="border border-line-strong transition-transform duration-200 hover:scale-[1.02] hover:border-fg active:scale-[0.98]"
                          onFocus={handlePause}
                          onBlur={handleResume}
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

            {/* Customer reassurance trust pills - Permanently anchored */}
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/40 pt-4 type-small text-fg-muted">
              <span className="inline-flex items-center gap-1.5 text-fg/90">
                <Icon icon={Truck} size={15} className="text-accent-text" />
                <span>All 64 Districts COD</span>
              </span>
              <span className="hidden text-line-strong sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5 text-fg/90">
                <Icon icon={ShieldCheck} size={15} className="text-accent-text" />
                <span>Doorstep Inspection</span>
              </span>
              <span className="hidden text-line-strong sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5 text-fg/90">
                <Icon icon={RefreshCw} size={15} className="text-accent-text" />
                <span>7-Day Fit Exchange</span>
              </span>
            </div>
          </div>

          {/* Right Column: Permanently Anchored Showcase Stage - Dynamic Fit with Zero Distortion */}
          <div className="order-1 flex items-center justify-center lg:order-2 lg:col-span-6 xl:col-span-5">
            <div
              data-carousel-image
              onMouseEnter={handlePause}
              onMouseLeave={handleResume}
              className="group/frame xs:w-[290px] relative mx-auto flex aspect-[4/5] w-[270px] items-center justify-center overflow-hidden rounded-xs border border-line/90 bg-raised/80 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-700 hover:border-gold/70 hover:shadow-[0_25px_60px_rgba(168,135,90,0.14)] sm:w-[330px] md:w-[370px] lg:w-[400px] xl:w-[430px]"
            >
              {slides.map((slide, index) => {
                const isActive = index === currentIndex;
                const slideKey = slide.id || String(index);
                const isBroken = Boolean(brokenImages[slideKey]);
                const isContain = slide.imageFit === 'contain';
                const ratio = imageRatios[slideKey];
                const isWide = ratio !== undefined && ratio > 1.25;
                const isTall = ratio !== undefined && ratio < 0.82;

                return (
                  <div
                    key={`img-${slide.id || index}`}
                    aria-hidden={!isActive}
                    className={cn(
                      'absolute inset-0 size-full overflow-hidden transition-all duration-700 ease-out',
                      isActive
                        ? 'z-10 scale-100 opacity-100'
                        : 'pointer-events-none z-0 scale-[1.02] opacity-0',
                    )}
                  >
                    {!isBroken && slide.imageUrl ? (
                      isContain ? (
                        <>
                          {/* Ambient blurred backdrop: fills the entire 4:5 frame so canvas presence is always harmonized */}
                          <div className="absolute inset-0 scale-125 opacity-30 blur-xl">
                            <CatalogImage
                              src={slide.imageUrl}
                              alt=""
                              sizes="400px"
                              className="size-full object-cover"
                            />
                          </div>
                          <div className="via-stone-950/40 to-stone-950/85 absolute inset-0 bg-radial from-transparent" />

                          {/* Subtle studio exhibition overhead light */}
                          <div className="from-white/[0.08] pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b to-transparent" />

                          {/* Dynamic foreground product canvas on ambient pedestal */}
                          <div className="relative z-10 flex size-full flex-col items-center justify-center p-4 sm:p-6">
                            <div
                              className={cn(
                                'relative flex items-center justify-center transition-all duration-500 ease-out',
                                isWide
                                  ? 'h-auto max-h-[75%] w-full max-w-[94%]'
                                  : isTall
                                    ? 'h-full max-h-[92%] w-auto max-w-[88%]'
                                    : 'size-full max-h-[88%] max-w-[88%]',
                              )}
                            >
                              <CatalogImage
                                src={slide.imageUrl}
                                alt={slide.imageAlt || slide.title}
                                sizes="(max-width: 640px) 270px, (max-width: 1024px) 360px, 430px"
                                priority={index === 0}
                                onError={() =>
                                  setBrokenImages((prev) => ({
                                    ...prev,
                                    [slideKey]: true,
                                  }))
                                }
                                onLoad={(e) => handleImageLoad(slideKey, e)}
                                className="size-full object-contain drop-shadow-2xl transition-transform duration-700 ease-auren group-hover/frame:scale-[1.03]"
                              />
                            </div>

                            {/* Exhibition studio contact shadow beneath the garment */}
                            <div
                              aria-hidden="true"
                              className="bg-black/40 pointer-events-none mt-1 h-3.5 w-3/4 max-w-[260px] rounded-full blur-md transition-all duration-700 group-hover/frame:scale-105"
                            />
                          </div>
                        </>
                      ) : (
                        /* Uniform full-bleed cover for editorial campaign photography with dynamic portrait/landscape focal alignment */
                        <>
                          <CatalogImage
                            src={slide.imageUrl}
                            alt={slide.imageAlt || slide.title}
                            sizes="(max-width: 640px) 270px, (max-width: 1024px) 360px, 430px"
                            priority={index === 0}
                            onError={() =>
                              setBrokenImages((prev) => ({
                                ...prev,
                                [slideKey]: true,
                              }))
                            }
                            onLoad={(e) => handleImageLoad(slideKey, e)}
                            className={cn(
                              'size-full object-cover object-center transition-transform duration-1000 ease-auren group-hover/frame:scale-[1.035]',
                              isTall && 'object-[center_16%]',
                            )}
                          />
                          {/* Cinematic luxury edge vignette */}
                          <div className="from-black/55 to-black/15 pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent" />
                        </>
                      )
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-2 bg-sunken p-6 text-center">
                        <span className="type-caption font-mono tracking-widest text-gold uppercase">
                          Auren Archive
                        </span>
                        <span className="type-small text-fg-muted">Atelier Photography</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Floating Atelier Badge - Top Right */}
              <div className="shadow-xs pointer-events-none absolute top-3.5 right-3.5 z-20 flex items-center gap-1.5 rounded-xs border border-line/80 bg-page/85 px-2.5 py-1 type-caption font-mono tracking-widest text-accent-text uppercase backdrop-blur-md">
                <span className="text-gold">✦</span>
                <span>Auren Atelier</span>
              </div>

              {/* Slide Counter Status Pill - Bottom Left */}
              <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-20 flex items-center gap-1.5 rounded-xs border border-line/70 bg-page/80 px-2 py-0.5 type-caption font-mono text-fg-muted backdrop-blur-md">
                <span className="font-medium text-fg">
                  {String(currentIndex + 1).padStart(2, '0')}
                </span>
                <span className="text-line-strong">/</span>
                <span>{String(total).padStart(2, '0')}</span>
                <span className="hidden text-line-strong sm:inline">·</span>
                <span className="hidden tracking-wider text-gold-strong uppercase sm:inline dark:text-gold">
                  {activeSlide.imageFit === 'contain' ? 'Studio Fit' : 'Campaign'}
                </span>
              </div>

              {/* Top Gold Hairline Shimmer on Hover */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent opacity-0 transition-opacity duration-700 group-hover/frame:opacity-100" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom controls: Slide indicator bars, numbering & navigation controls */}
      {total > 1 ? (
        <div className="relative z-20 container-page pb-6 md:pb-10">
          <div className="flex flex-col gap-4 border-t border-line/40 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Interactive slide progress bars & numbers (does NOT pause on hover) */}
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
                      {isActive ? (
                        <div
                          key={`progress-${currentIndex}-${isPlaying}`}
                          className={cn(
                            'absolute inset-0 origin-left bg-gold',
                            isPlaying && !prefersReducedMotion
                              ? 'animate-carousel-progress'
                              : 'w-full',
                          )}
                          style={{
                            animationDuration: `${settings.autoplayInterval}ms`,
                            animationPlayState: isHovered || !isPlaying ? 'paused' : 'running',
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 w-0 bg-line-strong transition-all duration-300 group-hover/ind:w-1/3" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Play/pause toggle and Next / Prev buttons - Pauses on Hover */}
            <div
              data-carousel-nav
              onMouseEnter={handlePause}
              onMouseLeave={handleResume}
              className="flex items-center gap-2 self-end sm:gap-2.5 sm:self-auto"
            >
              {/* Autoplay toggle */}
              <button
                type="button"
                onClick={() => setIsPlaying((prev) => !prev)}
                onFocus={handlePause}
                onBlur={handleResume}
                aria-label={isPlaying ? 'Pause carousel autoplay' : 'Start carousel autoplay'}
                className="shadow-xs flex size-9 items-center justify-center rounded-xs border border-line/60 bg-page/80 text-fg-muted backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-gold hover:bg-gold/10 hover:text-gold focus:outline-none focus-visible:ring-1 focus-visible:ring-gold active:scale-95"
              >
                <Icon icon={isPlaying ? Pause : Play} size={15} aria-hidden />
              </button>

              {/* Prev slide button */}
              <button
                type="button"
                onClick={prev}
                onFocus={handlePause}
                onBlur={handleResume}
                aria-label="Previous slide"
                className="shadow-xs flex size-9 items-center justify-center rounded-xs border border-line/60 bg-page/80 text-fg-muted backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-gold hover:bg-gold/10 hover:text-gold focus:outline-none focus-visible:ring-1 focus-visible:ring-gold active:scale-95"
              >
                <Icon icon={ChevronLeft} size={16} aria-hidden />
              </button>

              {/* Next slide button */}
              <button
                type="button"
                onClick={next}
                onFocus={handlePause}
                onBlur={handleResume}
                aria-label="Next slide"
                className="shadow-xs flex size-9 items-center justify-center rounded-xs border border-line/60 bg-page/80 text-fg-muted backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-gold hover:bg-gold/10 hover:text-gold focus:outline-none focus-visible:ring-1 focus-visible:ring-gold active:scale-95"
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
      className="relative flex min-h-[560px] w-full animate-pulse flex-col justify-between bg-page pt-(--header-height) text-fg md:min-h-[600px] lg:min-h-[660px]"
    >
      <div className="container-page flex flex-1 flex-col justify-center py-6 md:py-8 lg:py-10">
        <div className="grid w-full items-center gap-8 lg:grid-cols-12 lg:gap-14">
          <div className="order-2 flex flex-col gap-4 lg:order-1 lg:col-span-6 xl:col-span-7">
            <div className="h-4 w-32 rounded-xs bg-line/60" />
            <div className="h-12 w-3/4 rounded-xs bg-line/80" />
            <div className="h-16 w-full max-w-lg rounded-xs bg-line/40" />
            <div className="flex gap-4 pt-3">
              <div className="h-11 w-36 rounded-xs bg-line" />
              <div className="h-11 w-28 rounded-xs bg-line/50" />
            </div>
            <div className="mt-8 flex gap-4 border-t border-line/40 pt-4">
              <div className="h-4 w-28 rounded-xs bg-line/40" />
              <div className="h-4 w-28 rounded-xs bg-line/40" />
              <div className="h-4 w-28 rounded-xs bg-line/40" />
            </div>
          </div>
          <div className="order-1 flex items-center justify-center lg:order-2 lg:col-span-6 xl:col-span-5">
            <div className="xs:w-[290px] aspect-[4/5] w-[270px] rounded-xs bg-line/40 sm:w-[330px] md:w-[370px] lg:w-[400px] xl:w-[430px]" />
          </div>
        </div>
      </div>
      <div className="container-page pb-6 md:pb-10">
        <div className="flex items-center justify-between border-t border-line/40 pt-5">
          <div className="flex gap-3">
            <div className="h-2 w-16 rounded-xs bg-line/40" />
            <div className="h-2 w-16 rounded-xs bg-line/40" />
            <div className="h-2 w-16 rounded-xs bg-line/40" />
          </div>
          <div className="flex gap-3">
            <div className="size-9 rounded-xs bg-line/40" />
            <div className="size-9 rounded-xs bg-line/40" />
          </div>
        </div>
      </div>
    </section>
  );
}
