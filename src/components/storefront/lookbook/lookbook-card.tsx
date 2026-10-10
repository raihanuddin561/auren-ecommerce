import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { LookbookListItem } from '@/modules/lookbook/types';

export function LookbookCard({ lookbook }: { lookbook: LookbookListItem }) {
  return (
    <article className="group hover:shadow-xs relative flex flex-col overflow-hidden rounded-xs border border-line bg-page transition-all duration-300 hover:border-accent-text/40">
      <Link href={`/lookbook/${lookbook.slug}`} className="block overflow-hidden">
        <div className="relative aspect-4/5 w-full overflow-hidden bg-raised">
          <Image
            src={lookbook.heroImage}
            alt={lookbook.heroImageAlt || lookbook.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Season Tag */}
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-1.5 rounded-xs border border-line/60 bg-page/90 px-2.5 py-1 type-caption font-mono tracking-widest text-fg uppercase backdrop-blur-xs">
              <Sparkles size={11} className="text-accent-text" />
              <span>{lookbook.season}</span>
            </span>
          </div>

          {/* Frames & Hotspots Counter Badge */}
          <div className="absolute right-4 bottom-4">
            <span className="rounded-xs bg-ink/75 px-2 py-0.5 type-caption font-mono text-ivory backdrop-blur-xs">
              {lookbook.slideCount} {lookbook.slideCount === 1 ? 'Frame' : 'Frames'} •{' '}
              {lookbook.hotspotCount} Pieces
            </span>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <span className="type-caption font-mono tracking-widest text-accent-text uppercase">
          {lookbook.season}
        </span>
        <h3 className="type-title-md mt-1.5 font-serif text-fg">
          <Link
            href={`/lookbook/${lookbook.slug}`}
            className="transition-colors hover:text-accent-text"
          >
            {lookbook.title}
          </Link>
        </h3>
        {lookbook.description && (
          <p className="mt-2 line-clamp-2 type-body-sm text-fg-muted">{lookbook.description}</p>
        )}

        <div className="mt-auto pt-6">
          <Link
            href={`/lookbook/${lookbook.slug}`}
            className="group/link inline-flex items-center gap-2 type-caption font-mono tracking-wider text-fg uppercase transition-colors hover:text-accent-text"
          >
            <span>Explore Editorial</span>
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
