import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

export function LookbookCuration() {
  return (
    <section aria-labelledby="lookbook-curation-heading" className="py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="type-eyebrow text-accent-text">Editorial Curation</p>
              <h2
                id="lookbook-curation-heading"
                className="mt-2 type-display-lg font-display text-fg"
              >
                The Season&apos;s Edit: Relaxed Elegance
              </h2>
            </div>
            <Button asChild variant="link" className="self-start md:self-auto">
              <Link href="/collections" className="group flex items-center gap-1.5">
                <span>View all collections</span>
                <Icon
                  icon={ArrowUpRight}
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            </Button>
          </div>
        </Reveal>

        {/* Feature Split Banner */}
        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-center">
          {/* Main Visual Frame (8 cols) */}
          <div className="relative aspect-16/9 overflow-hidden rounded-xs border border-line bg-sunken lg:col-span-8">
            <Image
              src="/editorial/lookbook.jpg"
              alt="Editorial model wearing sand linen overshirt and relaxed tailoring in architectural interior"
              fill
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="object-cover transition-transform duration-700 hover:scale-103"
            />
          </div>

          {/* Shoppable Curation Card (4 cols) */}
          <div className="flex flex-col justify-between rounded-xs border border-line bg-raised/50 p-8 lg:col-span-4 lg:p-10">
            <div>
              <span className="type-eyebrow text-accent-text">CAPSULE 04</span>
              <h3 className="mt-2 type-h2 font-display text-fg">The Linen & Wool Ensemble</h3>
              <p className="mt-3 type-body text-pretty text-fg-muted">
                Engineered for breathability under intense heat while preserving a razor-sharp
                drape. Paired with soft horn button accents and mid-rise pleats.
              </p>

              <div className="mt-6 space-y-3 border-t border-line pt-5">
                <Link
                  href="/shop/shirts"
                  className="group flex items-center justify-between py-2 text-fg transition-colors hover:text-gold"
                >
                  <span className="type-small font-medium">01 / The Sand Linen Overshirt</span>
                  <Icon
                    icon={ArrowUpRight}
                    size={16}
                    className="text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold"
                  />
                </Link>

                <Link
                  href="/shop/trousers"
                  className="group flex items-center justify-between py-2 text-fg transition-colors hover:text-gold"
                >
                  <span className="type-small font-medium">02 / The Tailored Formal Trouser</span>
                  <Icon
                    icon={ArrowUpRight}
                    size={16}
                    className="text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold"
                  />
                </Link>

                <Link
                  href="/shop"
                  className="group flex items-center justify-between py-2 text-fg transition-colors hover:text-gold"
                >
                  <span className="type-small font-medium">03 / Pure Cotton Undershirt</span>
                  <Icon
                    icon={ArrowUpRight}
                    size={16}
                    className="text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold"
                  />
                </Link>
              </div>
            </div>

            <div className="mt-8">
              <Button asChild size="lg" className="w-full">
                <Link href="/shop">Shop the complete look</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
