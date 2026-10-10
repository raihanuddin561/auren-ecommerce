import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, Sparkles } from 'lucide-react';
import type { ArticleListItem } from '@/modules/journal/types';

interface JournalHeroFeatureProps {
  article: ArticleListItem;
}

export function JournalHeroFeature({ article }: JournalHeroFeatureProps) {
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <article className="group relative overflow-hidden rounded-xs border border-line bg-page transition-all duration-300 hover:border-accent-text/40">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Big Hero Image */}
        <div className="relative aspect-16/10 min-h-[320px] overflow-hidden bg-raised md:min-h-[420px] lg:col-span-7 lg:aspect-auto">
          <Image
            src={article.heroImage}
            alt={article.heroImageAlt || article.title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </div>

        {/* Right: Narrative Editorial Box */}
        <div className="flex flex-col justify-center p-8 sm:p-10 lg:col-span-5 lg:p-12">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-xs border border-line bg-raised px-2.5 py-0.5 type-caption font-mono tracking-widest text-accent-text uppercase">
              <Sparkles size={11} />
              <span>Featured Story</span>
            </span>
            <span className="type-caption font-mono text-fg-muted">• {article.category}</span>
          </div>

          <h2 className="type-display-sm mt-4 font-serif text-fg md:text-4xl">
            <Link
              href={`/journal/${article.slug}`}
              className="transition-colors hover:text-accent-text"
            >
              {article.title}
            </Link>
          </h2>

          <p className="mt-4 type-body-sm leading-relaxed text-fg-muted">{article.excerpt}</p>

          <div className="mt-6 flex items-center gap-4 border-t border-line/60 pt-4 text-fg-muted">
            <span className="type-caption font-mono">{article.authorName}</span>
            {formattedDate && (
              <>
                <span className="type-caption font-mono">•</span>
                <span className="type-caption font-mono">{formattedDate}</span>
              </>
            )}
            <span className="type-caption font-mono">•</span>
            <span className="inline-flex items-center gap-1 type-caption font-mono">
              <Clock size={11} />
              <span>{article.readTimeMinutes} min read</span>
            </span>
          </div>

          <div className="mt-8">
            <Link
              href={`/journal/${article.slug}`}
              className="inline-flex items-center gap-2 rounded-xs bg-ink px-6 py-3 type-caption font-mono text-ivory transition-colors hover:bg-accent-text"
            >
              <span>Read Full Article</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
