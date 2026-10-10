'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, Eye, Edit2, ExternalLink, Search, X, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createArticleAction, updateArticleAction } from '@/modules/journal/actions';
import { searchProductsForHotspotsAction } from '@/modules/lookbook/actions';
import { ArticleBody } from '@/components/storefront/journal/article-body';
import type { ArticleDetailItem } from '@/modules/journal/types';
import type { ProductSummaryForHotspot } from '@/modules/lookbook/types';
import { money } from '@/lib/money';
import { formatPriceText } from '@/lib/price-format';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface ArticleEditorProps {
  initialArticle?: ArticleDetailItem;
}

export function ArticleEditor({ initialArticle }: ArticleEditorProps) {
  const router = useRouter();
  const isEditing = Boolean(initialArticle);

  const [title, setTitle] = useState(initialArticle?.title || '');
  const [slug, setSlug] = useState(initialArticle?.slug || '');
  const [category, setCategory] = useState(initialArticle?.category || 'Craft & Atelier');
  const [authorName, setAuthorName] = useState(initialArticle?.authorName || 'Auren Atelier');
  const [readTimeMinutes, setReadTimeMinutes] = useState(initialArticle?.readTimeMinutes || 4);
  const [heroImage, setHeroImage] = useState(
    initialArticle?.heroImage || '/editorial/materials.jpg',
  );
  const [heroImageAlt, setHeroImageAlt] = useState(initialArticle?.heroImageAlt || '');
  const [excerpt, setExcerpt] = useState(initialArticle?.excerpt || '');
  const [content, setContent] = useState(
    initialArticle?.content ||
      '# The Anatomy of Noble Linen\n\nThere is a profound distinction between synthetic technical fabrics and natural cellulose spun from pure European flax.\n\n> "A great garment does not fight the climate; it harmonizes with the temperature of the wearer."\n\n### The Irish Weaving Standard\n\nAt the Auren atelier, our linen is spun from certified Belgian and Irish flax fields.',
  );
  const [tagsInput, setTagsInput] = useState(
    initialArticle?.tags.join(', ') || 'Linen, Noble Fibers, Craftsmanship',
  );
  const [status, setStatus] = useState(initialArticle?.status || 'draft');
  const [seoTitle, setSeoTitle] = useState(initialArticle?.seoTitle || '');
  const [seoDescription, setSeoDescription] = useState(initialArticle?.seoDescription || '');

  // Attached Featured Products
  const [featuredProducts, setFeaturedProducts] = useState<
    Array<{
      id: string;
      title: string;
      slug: string;
      priceMinor: bigint | null;
      primaryImage: string | null;
    }>
  >(
    initialArticle?.featuredProducts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      priceMinor: p.priceMinor,
      primaryImage: p.primaryImage,
    })) || [],
  );

  // Product Search State
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSummaryForHotspot[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Editor View Mode
  const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEditing && (!slug || slug === toSlug(title))) {
      setSlug(toSlug(val));
    }
  };

  const handleSearchProducts = async (q: string) => {
    setProductSearch(q);
    setIsSearching(true);
    try {
      const res = await searchProductsForHotspotsAction(q);
      if (res.ok) {
        setSearchResults(res.data);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAttachProduct = (p: ProductSummaryForHotspot) => {
    if (!featuredProducts.some((item) => item.id === p.id)) {
      setFeaturedProducts([...featuredProducts, p]);
    }
    setProductSearch('');
    setSearchResults([]);
  };

  const handleDetachProduct = (id: string) => {
    setFeaturedProducts(featuredProducts.filter((p) => p.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (isEditing && initialArticle) {
        const res = await updateArticleAction({
          id: initialArticle.id,
          title,
          slug,
          category,
          authorName,
          readTimeMinutes,
          heroImage,
          heroImageAlt: heroImageAlt || undefined,
          excerpt,
          content,
          tags,
          status,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          featuredProductIds: featuredProducts.map((p) => p.id),
        });

        if (!res.ok) {
          setErrorMessage(res.error.message || 'Failed to update article');
          return;
        }

        router.push('/admin/journal');
        router.refresh();
      } else {
        const res = await createArticleAction({
          title,
          slug,
          category,
          authorName,
          readTimeMinutes,
          heroImage,
          heroImageAlt: heroImageAlt || undefined,
          excerpt,
          content,
          tags,
          status,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          featuredProductIds: featuredProducts.map((p) => p.id),
        });

        if (!res.ok) {
          setErrorMessage(res.error.message || 'Failed to create article');
          return;
        }

        router.push('/admin/journal');
        router.refresh();
      }
    } catch {
      setErrorMessage('An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {errorMessage && (
        <div className="rounded-xs border border-danger/40 bg-danger/10 p-4 type-caption text-danger">
          {errorMessage}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xs border border-line bg-page p-4">
        <div className="flex items-center gap-2">
          <span className="type-caption font-mono text-fg-muted uppercase">
            {isEditing ? 'Editing Article' : 'Drafting New Article'}
          </span>
          {initialArticle?.status === 'published' && (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/journal/${initialArticle.slug}`} target="_blank">
                <ExternalLink size={13} className="mr-1.5" />
                <span>Storefront</span>
              </Link>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xs border border-line bg-raised p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('write')}
              className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 type-caption font-mono transition-colors ${
                viewMode === 'write' ? 'shadow-xs bg-page font-medium text-fg' : 'text-fg-muted'
              }`}
            >
              <Edit2 size={12} />
              <span>Compose</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 type-caption font-mono transition-colors ${
                viewMode === 'preview' ? 'shadow-xs bg-page font-medium text-fg' : 'text-fg-muted'
              }`}
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>

          <Button type="submit" size="sm" disabled={isSaving}>
            <Save size={13} className="mr-1.5" />
            <span>{isSaving ? 'Publishing...' : 'Save Article'}</span>
          </Button>
        </div>
      </div>

      {/* Article Settings & Metadata */}
      <div className="space-y-4 rounded-xs border border-line bg-page p-6">
        <h3 className="type-title-md border-b border-line pb-3 font-serif text-fg">
          Editorial Attributes
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block type-caption font-medium text-fg">Article Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. The Architecture of Noble Linen"
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">URL Slug *</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(toSlug(e.target.value))}
              placeholder="the-architecture-of-noble-linen"
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="block type-caption font-medium text-fg">Category *</label>
            <input
              type="text"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Craft & Atelier, Fabric Studies..."
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">Author / Byline *</label>
            <input
              type="text"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Auren Atelier, Sartorial Director"
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">Read Time (Minutes)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={readTimeMinutes}
              onChange={(e) => setReadTimeMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')}
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block type-caption font-medium text-fg">Hero Image URL *</label>
            <input
              type="text"
              required
              value={heroImage}
              onChange={(e) => setHeroImage(e.target.value)}
              placeholder="/editorial/materials.jpg or https://..."
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">Image Alt Text (SEO)</label>
            <input
              type="text"
              value={heroImageAlt}
              onChange={(e) => setHeroImageAlt(e.target.value)}
              placeholder="Pure unbleached Irish flax yarns on wooden looms"
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
        </div>

        <div>
          <label className="block type-caption font-medium text-fg">Article Excerpt *</label>
          <textarea
            required
            rows={2}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="A compelling 2-sentence summary that captures the essence of the essay..."
            className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block type-caption font-medium text-fg">Tags (comma-separated)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Linen, Noble Fibers, Tailoring, Craftsmanship"
            className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
          />
        </div>
      </div>

      {/* Markdown Body Editor / Live Preview */}
      <div className="rounded-xs border border-line bg-page p-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="type-title-md font-serif text-fg">
            Article Narrative Body {viewMode === 'preview' && '(Live Preview)'}
          </h3>
          <span className="type-caption font-mono text-fg-muted">Markdown formatting enabled</span>
        </div>

        <div className="mt-4">
          {viewMode === 'write' ? (
            <textarea
              required
              rows={16}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xs border border-line bg-raised/30 p-4 font-mono text-xs leading-relaxed text-fg focus:border-accent-text focus:outline-hidden"
              placeholder="# Headline&#10;&#10;Write editorial paragraphs here...&#10;&#10;> Blockquote highlight"
            />
          ) : (
            <div className="shadow-xs rounded-xs border border-line/60 bg-page p-6">
              <ArticleBody content={content} />
            </div>
          )}
        </div>
      </div>

      {/* Featured Pieces Selector */}
      <div className="space-y-4 rounded-xs border border-line bg-page p-6">
        <div className="border-b border-line pb-3">
          <h3 className="type-title-md font-serif text-fg">Attached Garments</h3>
          <p className="type-caption text-fg-muted">
            Select garments from the atelier catalog to feature in the shoppable rail beneath this
            story.
          </p>
        </div>

        {/* Currently Attached Garments */}
        {featuredProducts.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {featuredProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xs border border-line bg-raised/30 p-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {p.primaryImage ? (
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-xs bg-raised">
                      <Image
                        src={p.primaryImage}
                        alt={p.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xs bg-raised text-fg-muted">
                      <ShoppingBag size={14} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-1 type-body-sm font-medium text-fg">{p.title}</p>
                    {p.priceMinor !== null && (
                      <p className="type-caption font-mono text-fg-muted">
                        {formatPriceText(money(p.priceMinor, 'BDT'))}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDetachProduct(p.id)}
                  className="rounded-xs p-1 text-fg-muted hover:bg-raised hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search & Add Garment Picker */}
        <div className="relative">
          <div className="relative">
            <Search size={14} className="absolute top-2.5 left-3 text-fg-muted" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => handleSearchProducts(e.target.value)}
              placeholder="Search catalog to attach garment (e.g. Oxford, Trouser, Linen)..."
              className="w-full rounded-xs border border-line bg-raised/40 py-2 pr-3 pl-9 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>

          {isSearching && (
            <div className="absolute top-full left-0 z-20 mt-1 w-full rounded-xs border border-line bg-page p-3 text-center type-caption text-fg-muted">
              Searching atelier catalog...
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="shadow-lg absolute top-full left-0 z-20 mt-1 max-h-60 w-full divide-y divide-line overflow-y-auto rounded-xs border border-line bg-page">
              {searchResults.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleAttachProduct(prod)}
                  className="flex w-full items-center justify-between gap-3 p-2.5 text-left transition-colors hover:bg-raised/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="min-w-0">
                      <p className="line-clamp-1 type-body-sm font-medium text-fg">{prod.title}</p>
                      <p className="type-caption font-mono text-fg-muted">
                        {prod.material || prod.slug}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 type-caption font-mono text-accent-text">
                    + Attach Piece
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEO Settings */}
      <div className="space-y-4 rounded-xs border border-line bg-page p-6">
        <h3 className="type-title-md border-b border-line pb-3 font-serif text-fg">
          Search Engine Optimization (SEO)
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block type-caption font-medium text-fg">Custom SEO Meta Title</label>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Leave empty to use article title"
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">
              Custom SEO Meta Description
            </label>
            <input
              type="text"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="Leave empty to use article excerpt"
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
