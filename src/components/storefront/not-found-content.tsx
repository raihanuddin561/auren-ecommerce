import { ArrowRight, BookOpen, Compass, MessageSquare, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ImageFrame } from '@/components/motion/image-frame';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

/**
 * Editorial 404 & Unreleased Capsule Experience:
 * High-fashion atelier aesthetic that reassures and guides customers
 * rather than presenting a cold dead end.
 */
export function NotFoundContent() {
  return (
    <section className="container-page py-12 md:py-20 lg:py-24">
      {/* Top Editorial Hero */}
      <div className="grid items-center gap-10 md:grid-cols-12 md:gap-14 lg:gap-16">
        {/* Visual Frame */}
        <div className="relative mx-auto w-full max-w-md md:order-2 md:col-span-5 md:max-w-none">
          <div className="shadow-soft relative overflow-hidden border border-line bg-raised">
            <ImageFrame
              src="/editorial/atelier.jpg"
              hoverSrc="/editorial/lookbook.jpg"
              alt="Auren master artisan tailoring garments in the Dhaka atelier"
              sizes="(min-width: 1024px) 480px, (min-width: 768px) 380px, 100vw"
              ratio="product"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/60 to-transparent p-5 text-ivory">
              <p className="type-eyebrow text-gold-soft">AUREN ATELIER • DHAKA</p>
              <p className="mt-1 font-serif text-sm tracking-wide text-ivory/90">
                Handcrafted menswear & bespoke commissions
              </p>
            </div>
          </div>
        </div>

        {/* Narrative & Search */}
        <div className="md:order-1 md:col-span-7">
          <div className="inline-flex items-center gap-2 border border-gold/30 bg-gold/5 px-3 py-1 type-eyebrow text-gold">
            <Sparkles className="size-3.5 text-gold" aria-hidden="true" />
            <span>PRIVATE ATELIER PREVIEW</span>
          </div>

          <h1 className="mt-4 type-display-lg font-light text-fg">
            Crafting Something Extraordinary
          </h1>

          <p className="mt-4 max-w-xl type-body text-fg-muted">
            The silhouette or capsule you selected is either in active craft with our master
            artisans in Dhaka, or has transitioned into our private archive. Every piece is worth
            the anticipation.
          </p>

          {/* Search form */}
          <div className="mt-8 max-w-lg">
            <form action="/search" method="get" role="search" className="flex gap-2">
              <FormField label="Search the collection" hideLabel className="flex-1">
                {(control) => (
                  <Input
                    {...control}
                    name="q"
                    type="search"
                    placeholder="Search panjabi, fine shirting, trousers..."
                    className="border-line bg-page focus:border-gold"
                  />
                )}
              </FormField>
              <Button type="submit" size="md" variant="primary" aria-label="Search">
                <Icon icon={Search} size={18} />
              </Button>
            </form>

            {/* Quick Capsule Chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="type-eyebrow text-fg-muted">Curated capsules:</span>
              <Link
                href="/collections/bestsellers"
                className="touch-target inline-flex items-center rounded-full border border-line bg-raised px-3 py-1 type-small text-fg transition-auren-fast hover:border-gold hover:text-gold"
              >
                Bestsellers
              </Link>
              <Link
                href="/collections/new-arrivals"
                className="touch-target inline-flex items-center rounded-full border border-line bg-raised px-3 py-1 type-small text-fg transition-auren-fast hover:border-gold hover:text-gold"
              >
                New Arrivals
              </Link>
              <Link
                href="/shop"
                className="touch-target inline-flex items-center rounded-full border border-line bg-raised px-3 py-1 type-small text-fg transition-auren-fast hover:border-gold hover:text-gold"
              >
                All Pieces
              </Link>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6">
            <Button asChild variant="link" className="px-0 text-fg hover:text-gold">
              <Link href="/shop">Shop all</Link>
            </Button>
            <Button asChild variant="link" className="px-0 text-fg hover:text-gold">
              <Link href="/collections/bestsellers">Bestsellers</Link>
            </Button>
            <Button asChild variant="link" className="px-0 text-fg hover:text-gold">
              <Link href="/">Return home</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Exploration Portals */}
      <div className="mt-16 border-t border-line pt-12 md:mt-24 md:pt-16">
        <div className="mb-8">
          <p className="type-eyebrow text-gold">WHERE TO EXPLORE NEXT</p>
          <h2 className="mt-1 type-h2 text-fg">Curated Destinations</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Portal 1 */}
          <Link
            href="/shop"
            className="group transition-auren-normal hover:shadow-soft flex flex-col justify-between border border-line bg-raised p-6 hover:border-gold"
          >
            <div>
              <div className="flex size-10 items-center justify-center border border-gold/30 bg-gold/10 text-gold transition-auren-fast group-hover:bg-gold group-hover:text-ink">
                <Compass className="size-5" />
              </div>
              <h3 className="mt-4 type-h3 text-fg transition-auren-fast group-hover:text-gold">
                The Active Season
              </h3>
              <p className="mt-2 type-small text-fg-muted">
                Explore ready-to-ship tailoring, silk-blend panjabis, fine Egyptian cotton shirts,
                and seasonal accessories.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 type-small font-medium text-gold">
              <span>Explore collection</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Portal 2 */}
          <Link
            href="/lookbook"
            className="group transition-auren-normal hover:shadow-soft flex flex-col justify-between border border-line bg-raised p-6 hover:border-gold"
          >
            <div>
              <div className="flex size-10 items-center justify-center border border-gold/30 bg-gold/10 text-gold transition-auren-fast group-hover:bg-gold group-hover:text-ink">
                <BookOpen className="size-5" />
              </div>
              <h3 className="mt-4 type-h3 text-fg transition-auren-fast group-hover:text-gold">
                Campaign Lookbook
              </h3>
              <p className="mt-2 type-small text-fg-muted">
                Immerse yourself in our cinematic editorial photography, styling inspirations, and
                artisan craft stories.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 type-small font-medium text-gold">
              <span>View lookbook</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Portal 3 */}
          <Link
            href="/contact"
            className="group transition-auren-normal hover:shadow-soft flex flex-col justify-between border border-line bg-raised p-6 hover:border-gold"
          >
            <div>
              <div className="flex size-10 items-center justify-center border border-gold/30 bg-gold/10 text-gold transition-auren-fast group-hover:bg-gold group-hover:text-ink">
                <MessageSquare className="size-5" />
              </div>
              <h3 className="mt-4 type-h3 text-fg transition-auren-fast group-hover:text-gold">
                Private Concierge
              </h3>
              <p className="mt-2 type-small text-fg-muted">
                Inquire about bespoke tailoring, private sizing consultations, or early access to
                unreleased capsules.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 type-small font-medium text-gold">
              <span>Connect with stylist</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
