import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock } from 'lucide-react';
import type { ArticleListItem } from '@/modules/journal/types';

interface ArticleCardProps {
  article: ArticleListItem;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <article className="group hover:shadow-xs flex flex-col overflow-hidden rounded-xs border border-line bg-page transition-all duration-300 hover:border-accent-text/40">
      <Link href={`/journal/${article.slug}`} className="block overflow-hidden">
        <div className="relative aspect-16/10 w-full overflow-hidden bg-raised">
          <Image
            src={article.heroImage}
            alt={article.heroImageAlt || article.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute top-3 left-3">
            <span className="rounded-xs border border-line/60 bg-page/90 px-2 py-0.5 type-caption font-mono text-fg backdrop-blur-xs">
              {article.category}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3 text-fg-muted">
          {formattedDate && <span className="type-caption font-mono">{formattedDate}</span>}
          <span className="type-caption font-mono">•</span>
          <span className="inline-flex items-center gap-1 type-caption font-mono">
            <Clock size={11} />
            <span>{article.readTimeMinutes} min read</span>
          </span>
        </div>

        <h3 className="type-title-md mt-2 font-serif text-fg">
          <Link
            href={`/journal/${article.slug}`}
            className="transition-colors hover:text-accent-text"
          >
            {article.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-3 type-body-sm text-fg-muted">{article.excerpt}</p>

        {article.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-xs bg-raised px-2 py-0.5 type-caption font-mono text-fg-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-6">
          <Link
            href={`/journal/${article.slug}`}
            className="group/link inline-flex items-center gap-2 type-caption font-mono tracking-wider text-fg uppercase transition-colors hover:text-accent-text"
          >
            <span>Read Story</span>
            <ArrowRight
              size={13}
              className="transition-transform duration-300 group-hover/link:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}
