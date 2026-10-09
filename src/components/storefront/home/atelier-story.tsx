import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';

export function AtelierStory() {
  return (
    <section
      aria-labelledby="atelier-story-heading"
      className="border-y border-line bg-ink py-20 text-paper md:py-28"
    >
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Image Frame (Left 5 cols) */}
          <div className="relative aspect-4/5 overflow-hidden rounded-xs border border-stone-800 bg-stone-900 lg:col-span-5">
            <Image
              src="/editorial/craftsmanship.jpg"
              alt="Close-up of bespoke AUREN tailored wool suit jacket on tailoring bust with hand-stitched lapel"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>

          {/* Editorial Content (Right 7 cols) */}
          <div className="lg:col-span-7">
            <Reveal>
              <p className="type-eyebrow text-gold">The Atelier Standard</p>
              <h2
                id="atelier-story-heading"
                className="mt-3 type-display-lg font-display text-paper"
              >
                The architecture of fit.
              </h2>
              <p className="mt-5 type-body text-pretty text-stone-300 md:text-lg">
                True luxury is felt in the weight of the drape and seen in the restraint of the
                silhouette. Every AUREN piece is engineered with relaxed ease for the warm
                subtropics, yet sculpted with the architectural precision required for high-stakes
                settings.
              </p>
            </Reveal>

            <Reveal>
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                <div className="border-l border-gold/40 pl-5">
                  <span className="type-small font-mono text-gold">01 / FIBERS</span>
                  <h3 className="mt-1 type-h3 font-medium text-paper">Noble Natural Weaves</h3>
                  <p className="mt-1.5 type-small text-stone-400">
                    Long-staple Egyptian Giza cotton, breathable French linen, and tropical Super
                    120s merino wools. Zero polyester synthetics.
                  </p>
                </div>

                <div className="border-l border-gold/40 pl-5">
                  <span className="type-small font-mono text-gold">02 / FINISH</span>
                  <h3 className="mt-1 type-h3 font-medium text-paper">Artisan Construction</h3>
                  <p className="mt-1.5 type-small text-stone-400">
                    French enclosed seams, hand-turned collars, pick-stitched lapels, and genuine
                    buffalo horn buttons with cross-stitched shanks.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-paper text-ink hover:bg-gold hover:text-ink"
                >
                  <Link href="/about">Discover the Atelier Story</Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="border-stone-700 text-stone-200 hover:border-gold hover:text-paper"
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
