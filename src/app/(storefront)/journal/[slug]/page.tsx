import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, ArrowLeft, Clock, Calendar, User } from 'lucide-react';
import { getStorefrontArticleDetailQuery } from '@/modules/journal/queries';
import { ArticleBody } from '@/components/storefront/journal/article-body';
import { FeaturedGarmentsRail } from '@/components/storefront/journal/featured-garments-rail';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { articleJsonLd, serializeJsonLd } from '@/lib/seo/jsonld';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getStorefrontArticleDetailQuery(slug);

  if (!article) {
    return buildPageMetadata({
      title: 'Article Not Found',
      path: `/journal/${slug}`,
    });
  }

  return buildPageMetadata({
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt,
    path: `/journal/${slug}`,
    image: article.heroImage,
  });
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getStorefrontArticleDetailQuery(slug);

  if (!article) {
    notFound();
  }

  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const jsonLd = articleJsonLd({
    title: article.title,
    description: article.excerpt,
    path: `/journal/${article.slug}`,
    publishedAt: article.publishedAt
      ? article.publishedAt.toISOString()
      : article.createdAt.toISOString(),
    image: article.heroImage,
    author: article.authorName,
  });

  return (
    <article className="min-h-screen bg-page">
      {/* Schema.org Article Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

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
            <Link href="/journal" className="hover:text-fg">
              Journal
            </Link>
            <ChevronRight size={12} />
            <span className="max-w-[200px] truncate text-fg sm:max-w-none">{article.title}</span>
          </nav>
        </div>
      </div>

      {/* Article Header */}
      <header className="container mx-auto px-4 pt-12 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-xs border border-line bg-raised px-2.5 py-0.5 type-caption font-mono tracking-widest text-accent-text uppercase">
            {article.category}
          </span>

          <h1 className="type-display-sm mt-4 font-serif text-fg md:text-5xl">{article.title}</h1>

          <p className="mt-4 type-body-sm leading-relaxed text-fg-muted">{article.excerpt}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-line/60 pt-4 type-caption font-mono text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <User size={12} />
              <span>{article.authorName}</span>
            </span>
            {formattedDate && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{formattedDate}</span>
                </span>
              </>
            )}
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              <span>{article.readTimeMinutes} min read</span>
            </span>
          </div>
        </div>
      </header>

      {/* Hero Image */}
      <div className="container mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="shadow-xs relative aspect-16/9 w-full overflow-hidden rounded-xs border border-line bg-raised">
          <Image
            src={article.heroImage}
            alt={article.heroImageAlt || article.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 896px"
            className="object-cover"
          />
        </div>
        {article.heroImageAlt && (
          <p className="mt-2 text-center type-caption font-serif text-fg-muted italic">
            {article.heroImageAlt}
          </p>
        )}
      </div>

      {/* Article Body Content */}
      <div className="container mx-auto px-4 pb-16 sm:px-6 lg:px-8">
        <ArticleBody content={article.content} />

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="mx-auto mt-12 max-w-3xl border-t border-line pt-6">
            <span className="type-caption font-mono tracking-widest text-accent-text uppercase">
              Topics
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/journal?tag=${encodeURIComponent(tag)}`}
                  className="rounded-xs border border-line bg-raised px-2.5 py-1 type-caption font-mono text-fg hover:border-accent-text"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Featured Garments Section */}
      <FeaturedGarmentsRail products={article.featuredProducts} />

      {/* Back to Journal Link */}
      <div className="border-t border-line py-8 text-center">
        <Link
          href="/journal"
          className="inline-flex items-center gap-2 type-caption font-mono tracking-wider text-fg uppercase hover:text-accent-text"
        >
          <ArrowLeft size={13} />
          <span>Back to All Journal Stories</span>
        </Link>
      </div>
    </article>
  );
}
