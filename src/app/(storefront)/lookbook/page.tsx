import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { getStorefrontLookbooksQuery } from '@/modules/lookbook/queries';
import { LookbookCard } from '@/components/storefront/lookbook/lookbook-card';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Seasonal Lookbooks',
  description:
    'Visual narratives of noble fibers, sculptured silhouettes, and architectural tailoring in modern Dhaka.',
  path: '/lookbook',
});

export default async function LookbooksPage() {
  const lookbooks = await getStorefrontLookbooksQuery();

  return (
    <div className="min-h-screen bg-page">
      {/* Header Banner */}
      <section className="border-b border-line bg-raised/30 py-16 md:py-24">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 type-caption font-mono tracking-widest text-accent-text uppercase">
            <Sparkles size={12} />
            <span>The Atelier Lookbooks</span>
          </span>
          <h1 className="type-display-sm mt-3 font-serif text-fg md:text-5xl">
            Sartorial Curations
          </h1>
          <p className="mx-auto mt-4 max-w-2xl type-body-sm text-fg-muted">
            Explore seasonal explorations of noble textures, tactile weights, and quiet luxury.
            Interact with shoppable hotspots on each garment to discover its tailoring architecture.
          </p>
        </div>
      </section>

      {/* Lookbooks Grid */}
      <section className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {lookbooks.length === 0 ? (
          <div className="rounded-xs border border-line bg-raised/20 p-16 text-center text-fg-muted">
            <p className="type-title-md font-serif text-fg">Curating New Editorials</p>
            <p className="mt-2 type-body-sm">
              Our upcoming seasonal collection lookbook is currently in production.
            </p>
            <div className="mt-6">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-xs bg-ink px-5 py-2.5 type-caption font-mono text-ivory transition-colors hover:bg-accent-text"
              >
                <span>Browse The Collection</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {lookbooks.map((lb) => (
              <LookbookCard key={lb.id} lookbook={lb} />
            ))}
          </div>
        )}
      </section>

      {/* Atelier Craft Footnote */}
      <section className="border-t border-line bg-page py-16">
        <div className="container mx-auto max-w-3xl px-4 text-center sm:px-6">
          <blockquote className="type-title-md font-serif text-fg italic">
            &ldquo;We cut for proportion, drape, and the natural posture of the human frame. Luxury
            is experienced in the ease of movement.&rdquo;
          </blockquote>
          <p className="mt-3 type-caption font-mono text-accent-text uppercase">
            — Auren Head Tailor, Banani Atelier
          </p>
        </div>
      </section>
    </div>
  );
}
