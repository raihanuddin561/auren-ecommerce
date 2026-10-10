'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { getSearchSuggestionsAction } from '@/modules/search/actions';
import type { CategorySuggestion, SearchProductSuggestion } from '@/modules/search/types';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_POPULAR = [
  'Linen Shirt',
  'Pleated Trousers',
  'Cashmere Polo',
  'Silk Overshirt',
  'Safari Jacket',
  'Fine Knitwear',
];

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<SearchProductSuggestion[]>([]);
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);
  const [popular, setPopular] = useState<string[]>(DEFAULT_POPULAR);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const displayProducts = query.trim().length < 2 ? [] : products;
  const displayCategories = query.trim().length < 2 ? [] : categories;

  // Debounced search suggestions
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getSearchSuggestionsAction({ q: trimmed });
        if (res.ok) {
          setProducts(res.data.products);
          setCategories(res.data.categories);
          if (res.data.popular?.length) {
            setPopular(res.data.popular);
          }
        }
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(handler);
  }, [query]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onClose();
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    });
  }

  function handleSelectTerm(term: string) {
    setQuery(term);
    inputRef.current?.focus();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search Collection"
      className="fixed inset-0 z-50 flex flex-col bg-ink/75 backdrop-blur-md"
    >
      {/* Backdrop click dismiss */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="w-full border-b border-line bg-page/95 shadow-float backdrop-blur-md">
        <div className="container-editorial py-6">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-4">
            <span className="type-eyebrow font-medium tracking-widest text-gold uppercase">
              ✦ Atelier Collection Discovery ✦
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="flex size-9 items-center justify-center rounded-full border border-line/60 p-2 text-fg-muted transition-all duration-200 hover:border-gold hover:bg-gold/10 hover:text-gold"
            >
              <Icon icon={X} size={18} />
            </button>
          </div>

          {/* Search Input Form */}
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <Icon
              icon={Search}
              size={22}
              className="pointer-events-none absolute left-0 text-gold"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search garments, noble fabrics, silhouettes..."
              className="w-full border-b border-line/80 bg-transparent py-4 pr-28 pl-10 font-serif text-xl text-fg placeholder:text-fg-muted/60 focus:border-gold focus:outline-none md:text-2xl"
              autoComplete="off"
            />
            {query ? (
              <button
                type="submit"
                className="absolute right-0 flex items-center gap-1.5 rounded-xs border border-gold/40 bg-gold/10 px-3 py-1.5 type-eyebrow font-medium text-gold transition-all duration-200 hover:bg-gold hover:text-ink"
              >
                <span>View all</span>
                <Icon icon={ArrowRight} size={14} />
              </button>
            ) : null}
          </form>

          {/* Popular Searches when no query */}
          {query.trim().length < 2 ? (
            <div className="mt-8 flex flex-col gap-3">
              <p className="type-eyebrow font-medium tracking-eyebrow text-gold uppercase">
                Trending Curations
              </p>
              <div className="flex flex-wrap gap-2">
                {popular.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleSelectTerm(term)}
                    className="rounded-full border border-line/70 bg-raised px-4 py-1.5 type-small text-fg transition-all duration-200 hover:scale-105 hover:border-gold hover:bg-gold/5 hover:text-gold active:scale-95"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Live Suggestions Container */
            <div className="mt-8 flex flex-col gap-6">
              {/* Category Matches */}
              {displayCategories.length > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="type-eyebrow text-fg-muted">In categories:</span>
                  <div className="flex flex-wrap gap-2">
                    {displayCategories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/shop/${cat.path}`}
                        onClick={onClose}
                        className="bg-subtle border border-line px-3 py-1 type-small text-fg hover:border-gold"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Product Matches */}
              {loading ? (
                <div className="flex items-center gap-2 py-6 type-small text-fg-muted">
                  <span className="size-4 animate-spin rounded-full border-2 border-line border-t-fg" />
                  <span>Curating pieces...</span>
                </div>
              ) : displayProducts.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="type-eyebrow text-fg-muted">Suggested Pieces</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {displayProducts.map((prod) => (
                      <Link
                        key={prod.id}
                        href={`/products/${prod.slug}`}
                        onClick={onClose}
                        className="group hover:shadow-subtle flex flex-col border border-line bg-raised p-3 transition-auren-fast hover:border-line-strong"
                      >
                        <div className="bg-subtle relative aspect-4/5 w-full overflow-hidden">
                          {prod.imageUrl ? (
                            <Image
                              src={prod.imageUrl}
                              alt={prod.imageAlt ?? prod.title}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 20vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-fg-muted">
                              <Icon icon={Search} size={24} />
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex flex-col">
                          {prod.categoryName ? (
                            <span className="type-eyebrow text-fg-muted">{prod.categoryName}</span>
                          ) : null}
                          <span className="line-clamp-1 font-serif text-base text-fg group-hover:underline">
                            {prod.title}
                          </span>
                          <span className="mt-1 font-sans font-medium text-fg">
                            {prod.priceFormatted}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={handleSubmit as unknown as React.MouseEventHandler}
                      className="flex items-center gap-2 border border-line bg-raised px-6 py-2.5 type-eyebrow text-fg transition-auren-fast hover:border-fg hover:bg-fg/5"
                    >
                      <span>Explore all matching pieces</span>
                      <Icon icon={ArrowRight} size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="type-body text-fg-muted">
                    No garments found matching &ldquo;{query}&rdquo;.
                  </p>
                  <p className="mt-1 type-small text-fg-muted">
                    Try searching for fabric types, garment categories, or classic staples.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
