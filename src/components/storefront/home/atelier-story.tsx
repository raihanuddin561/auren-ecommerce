import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';

export function AtelierStory() {
  return (
    <section
      data-tone="ink"
      aria-labelledby="atelier-story-heading"
      className="border-y border-line bg-page py-20 text-fg md:py-28"
    >
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Image Frame (Left 5 cols) */}
          <div className="group/frame relative aspect-4/5 overflow-hidden rounded-xs border border-line bg-raised shadow-float lg:col-span-5">
            <Image
              src="/editorial/craftsmanship.jpg"
              alt="Close-up of bespoke AUREN tailored wool suit jacket on tailoring bust with hand-stitched lapel"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover transition-transform duration-700 ease-auren group-hover/frame:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-page/50 via-transparent to-transparent" />
            <div className="pointer-events-none absolute bottom-3.5 left-3.5 rounded-xs border border-line/80 bg-page/90 px-2 py-0.5 type-caption font-mono text-accent-text uppercase backdrop-blur-xs">
              Atelier Archive
            </div>
          </div>

          {/* Editorial Content (Right 7 cols) */}
          <div className="lg:col-span-7">
            <Reveal>
              <p className="type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase">
                The Atelier Standard
              </p>
              <h2 id="atelier-story-heading" className="mt-3 type-display-lg font-display text-fg">
                The architecture of fit.
              </h2>
              <p className="mt-5 type-body text-pretty text-fg-muted md:text-lg">
                True luxury is felt in the weight of the drape and seen in the restraint of the
                silhouette. Every AUREN piece is engineered with relaxed ease for the warm
                subtropics, yet sculpted with the architectural precision required for high-stakes
                settings.
              </p>
            </Reveal>

            <Reveal>
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                <div className="border-l border-gold/40 pl-5">
                  <span className="type-caption font-mono tracking-wider text-accent-text">
                    01 / NOBLE FIBERS
                  </span>
                  <h3 className="mt-1 type-h3 font-medium text-fg">Natural Weaves</h3>
                  <p className="mt-1.5 type-small text-fg-muted">
                    Long-staple Egyptian Giza cotton, breathable French linen, and tropical Super
                    120s merino wools. Zero synthetic blends.
                  </p>
                </div>

                <div className="border-l border-gold/40 pl-5">
                  <span className="type-caption font-mono tracking-wider text-accent-text">
                    02 / TAILORED FINISH
                  </span>
                  <h3 className="mt-1 type-h3 font-medium text-fg">Artisan Precision</h3>
                  <p className="mt-1.5 type-small text-fg-muted">
                    French enclosed seams, hand-turned collars, pick-stitched lapels, and genuine
                    buffalo horn buttons with cross-stitched shanks.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="tracking-button">
                  <Link href="/about">Discover the Atelier Story</Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="border-line-strong text-fg hover:border-gold hover:text-fg"
                >
                  <Link href="/shop/tailoring">Explore Tailoring</Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
