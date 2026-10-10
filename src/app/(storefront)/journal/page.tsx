import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Rss, Sparkles } from 'lucide-react';
import {
  getStorefrontArticlesQuery,
  getStorefrontCategoriesAndTagsQuery,
} from '@/modules/journal/queries';
import { JournalHeroFeature } from '@/components/storefront/journal/journal-hero-feature';
import { ArticleCard } from '@/components/storefront/journal/article-card';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'The Journal',
  description:
    'Essays on craftsmanship, noble fibers, architectural tailoring, and contemporary Dhaka menswear.',
  path: '/journal',
});

interface JournalPageProps {
  searchParams: Promise<{
    category?: string;
    tag?: string;
    search?: string;
  }>;
}

async function JournalContent({ searchParams }: JournalPageProps) {
  const resolvedParams = await searchParams;
  const activeCategory = resolvedParams.category || 'all';

  const [{ items: articles }, { categories }] = await Promise.all([
    getStorefrontArticlesQuery({
      category: activeCategory !== 'all' ? activeCategory : undefined,
      tag: resolvedParams.tag,
      search: resolvedParams.search,
      pageSize: 20,
    }),
    getStorefrontCategoriesAndTagsQuery(),
  ]);

  const featuredArticle =
    activeCategory === 'all' && !resolvedParams.tag && !resolvedParams.search ? articles[0] : null;
  const remainingArticles = featuredArticle ? articles.slice(1) : articles;

  return (
    <div className="min-h-screen bg-page">
      {/* Header Banner */}
      <section className="border-b border-line bg-raised/30 py-16 md:py-24">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 type-caption font-mono tracking-widest text-accent-text uppercase">
            <Sparkles size={12} />
            <span>Atelier &amp; Sartorial Notes</span>
          </span>
          <h1 className="type-display-sm mt-3 font-serif text-fg md:text-5xl">The AUREN Journal</h1>
          <p className="mx-auto mt-4 max-w-2xl type-body-sm text-fg-muted">
            Essays on fabric architecture, the mathematics of tailoring, noble fibers, and the
            modern menswear dialogue in Dhaka.
          </p>

          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/feed.xml"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xs border border-line bg-page px-3 py-1 type-caption font-mono text-fg-muted transition-colors hover:border-accent-text hover:text-accent-text"
            >
              <Rss size={12} />
              <span>RSS Feed</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Category Filter Bar */}
      <section className="sticky top-16 z-20 border-b border-line bg-page bg-page/90 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1">
            <Link
              href="/journal"
              className={`rounded-xs px-3 py-1 type-caption font-mono whitespace-nowrap transition-colors ${
                activeCategory === 'all'
                  ? 'bg-ink text-ivory'
                  : 'border border-line bg-raised/50 text-fg hover:border-accent-text'
              }`}
            >
              All Stories
            </Link>
            {categories.map((cat) => {
              const isSelected = activeCategory.toLowerCase() === cat.toLowerCase();
              return (
                <Link
                  key={cat}
                  href={`/journal?category=${encodeURIComponent(cat)}`}
                  className={`rounded-xs px-3 py-1 type-caption font-mono whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-ink text-ivory'
                      : 'border border-line bg-raised/50 text-fg hover:border-accent-text'
                  }`}
                >
                  {cat}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Journal Content */}
      <section className="container mx-auto space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        {/* Spotlight Hero Article */}
        {featuredArticle && <JournalHeroFeature article={featuredArticle} />}

        {/* Articles Grid */}
        {remainingArticles.length === 0 && !featuredArticle ? (
          <div className="rounded-xs border border-line bg-raised/20 p-16 text-center text-fg-muted">
            <p className="type-title-md font-serif text-fg">No Stories Found</p>
            <p className="mt-2 type-body-sm">
              No journal articles found matching the current category or search criteria.
            </p>
            <div className="mt-6">
              <Link
                href="/journal"
                className="inline-flex items-center gap-2 rounded-xs bg-ink px-4 py-2 type-caption font-mono text-ivory transition-colors hover:bg-accent-text"
              >
                <span>View All Stories</span>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {featuredArticle && remainingArticles.length > 0 && (
              <div className="mb-6 border-b border-line pb-2">
                <span className="type-caption font-mono tracking-widest text-accent-text uppercase">
                  Recent Essays
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {remainingArticles.map((art) => (
                <ArticleCard key={art.id} article={art} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function JournalSkeleton() {
  return (
    <div className="min-h-screen bg-page">
      <section className="border-b border-line bg-raised/30 py-16 md:py-24">
        <div className="container mx-auto space-y-3 px-4 text-center sm:px-6 lg:px-8">
          <div className="mx-auto h-4 w-32 animate-skeleton rounded-xs bg-skeleton" />
          <div className="mx-auto h-10 w-64 animate-skeleton rounded-xs bg-skeleton" />
          <div className="mx-auto h-4 w-96 animate-skeleton rounded-xs bg-skeleton" />
        </div>
      </section>
      <section className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-4/3 animate-skeleton rounded-xs bg-skeleton" />
          ))}
        </div>
      </section>
    </div>
  );
}

export default function JournalPage(props: JournalPageProps) {
  return (
    <Suspense fallback={<JournalSkeleton />}>
      <JournalContent {...props} />
    </Suspense>
  );
}
