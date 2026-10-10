import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { ChevronRight, ArrowLeft, ShoppingBag } from 'lucide-react';
import { getStorefrontLookbookDetailQuery } from '@/modules/lookbook/queries';
import { LookbookViewer } from '@/components/storefront/lookbook/lookbook-viewer';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { money } from '@/lib/money';
import { formatPriceText } from '@/lib/price-format';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lookbook = await getStorefrontLookbookDetailQuery(slug);

  if (!lookbook) {
    return buildPageMetadata({
      title: 'Lookbook Not Found',
      path: `/lookbook/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${lookbook.title} — ${lookbook.season}`,
    description:
      lookbook.description ||
      `Explore the ${lookbook.season} editorial lookbook with shoppable atelier pieces.`,
    path: `/lookbook/${slug}`,
    image: lookbook.heroImage,
  });
}

async function LookbookContent({ params }: PageProps) {
  const { slug } = await params;
  const lookbook = await getStorefrontLookbookDetailQuery(slug);

  if (!lookbook) {
    notFound();
  }

  // Deduplicate all products featured across the hotspots in this lookbook
  const featuredProductMap = new Map<
    string,
    {
      id: string;
      title: string;
      slug: string;
      material: string | null;
      priceMinor: bigint | null;
      compareAtMinor: bigint | null;
      primaryImage: string | null;
    }
  >();

  for (const slide of lookbook.slides) {
    for (const hotspot of slide.hotspots) {
      if (hotspot.product && !featuredProductMap.has(hotspot.product.id)) {
        featuredProductMap.set(hotspot.product.id, hotspot.product);
      }
    }
  }

  const allFeaturedProducts = Array.from(featuredProductMap.values());

  return (
    <div className="min-h-screen bg-page">
      {/* Breadcrumb Bar */}
      <div className="border-b border-line bg-raised/20">
        <div className="container mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 type-caption font-mono text-fg-muted"
          >
            <Link href="/" className="hover:text-fg">
              House
            </Link>
            <ChevronRight size={12} />
            <Link href="/lookbook" className="hover:text-fg">
              Lookbooks
            </Link>
            <ChevronRight size={12} />
            <span className="max-w-[200px] truncate text-fg sm:max-w-none">{lookbook.title}</span>
          </nav>
        </div>
      </div>

      {/* Editorial Header */}
      <section className="container mx-auto px-4 pt-10 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="rounded-xs border border-line bg-raised px-2.5 py-0.5 type-caption font-mono tracking-widest text-accent-text uppercase">
              {lookbook.season}
            </span>
          </div>

          <h1 className="type-display-sm mt-4 font-serif text-fg md:text-5xl">{lookbook.title}</h1>

          {lookbook.description && (
            <p className="mx-auto mt-4 max-w-2xl type-body-sm text-fg-muted">
              {lookbook.description}
            </p>
          )}

          <p className="mt-3 type-caption font-mono text-accent-text">
            Hover or tap the pins on each frame to explore tailoring details and shop the look
          </p>
        </div>
      </section>

      {/* Main Interactive Lookbook Viewer */}
      <section className="container mx-auto px-4 pb-20 sm:px-6 lg:px-8">
        <LookbookViewer lookbook={lookbook} />
      </section>

      {/* Curated Pieces in This Story */}
      {allFeaturedProducts.length > 0 && (
        <section className="border-t border-line bg-raised/30 py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 text-center">
              <span className="type-caption font-mono tracking-widest text-accent-text uppercase">
                The Curated Capsule
              </span>
              <h2 className="type-title-md mt-2 font-serif text-fg">
                Pieces Featured in this Editorial
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
              {allFeaturedProducts.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="group hover:shadow-xs flex flex-col rounded-xs border border-line bg-page p-3 transition-all duration-300 hover:border-accent-text/40"
                >
                  <div className="relative aspect-4/5 w-full overflow-hidden rounded-xs bg-raised">
                    {p.primaryImage ? (
                      <Image
                        src={p.primaryImage}
                        alt={p.title}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-fg-muted">
                        <ShoppingBag size={24} />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-1 flex-col">
                    <h3 className="line-clamp-1 type-body-sm font-medium text-fg group-hover:text-accent-text">
                      {p.title}
                    </h3>
                    {p.material && (
                      <p className="line-clamp-1 type-caption text-fg-muted">{p.material}</p>
                    )}
                    <div className="mt-auto pt-2">
                      {p.priceMinor !== null && (
                        <span className="type-body-sm font-mono font-medium text-fg">
                          {formatPriceText(money(p.priceMinor, 'BDT'))}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back to Lookbooks Footer Link */}
      <div className="border-t border-line py-8 text-center">
        <Link
          href="/lookbook"
          className="inline-flex items-center gap-2 type-caption font-mono tracking-wider text-fg uppercase hover:text-accent-text"
        >
          <ArrowLeft size={13} />
          <span>Back to All Seasonal Lookbooks</span>
        </Link>
      </div>
    </div>
  );
}

function LookbookSkeleton() {
  return (
    <div className="min-h-screen bg-page">
      <div className="border-b border-line bg-raised/20">
        <div className="container mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="h-4 w-32 animate-skeleton rounded-xs bg-skeleton" />
        </div>
      </div>
      <section className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-4 text-center">
          <div className="mx-auto h-4 w-28 animate-skeleton rounded-xs bg-skeleton" />
          <div className="mx-auto h-12 w-80 animate-skeleton rounded-xs bg-skeleton" />
        </div>
        <div className="mx-auto mt-12 aspect-4/5 max-w-md animate-skeleton rounded-xs bg-skeleton" />
      </section>
    </div>
  );
}

export default function LookbookDetailPage(props: PageProps) {
  return (
    <Suspense fallback={<LookbookSkeleton />}>
      <LookbookContent {...props} />
    </Suspense>
  );
}
