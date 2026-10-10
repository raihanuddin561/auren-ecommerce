'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  Layers,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  updateLookbookAction,
  addSlideAction,
  deleteSlideAction,
  addHotspotAction,
  deleteHotspotAction,
  searchProductsForHotspotsAction,
} from '@/modules/lookbook/actions';
import type { LookbookDetailItem, ProductSummaryForHotspot } from '@/modules/lookbook/types';
import { money } from '@/lib/money';
import { formatPriceText } from '@/lib/price-format';

interface LookbookEditorProps {
  lookbook: LookbookDetailItem;
}

export function LookbookEditor({ lookbook }: LookbookEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(lookbook.title);
  const [slug, setSlug] = useState(lookbook.slug);
  const [season, setSeason] = useState(lookbook.season);
  const [description, setDescription] = useState(lookbook.description || '');
  const [heroImage, setHeroImage] = useState(lookbook.heroImage);
  const [status, setStatus] = useState(lookbook.status);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // New Slide Dialog State
  const [isAddSlideOpen, setIsAddSlideOpen] = useState(false);
  const [newSlideUrl, setNewSlideUrl] = useState('');
  const [newSlideAlt, setNewSlideAlt] = useState('');
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideCaption, setNewSlideCaption] = useState('');
  const [isAddingSlide, setIsAddingSlide] = useState(false);

  // Hotspot Click Placement & Product Picker State
  const [pendingHotspotCoord, setPendingHotspotCoord] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSummaryForHotspot[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [isAddingHotspot, setIsAddingHotspot] = useState(false);

  const activeSlide = lookbook.slides[activeSlideIndex];

  // Save Settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await updateLookbookAction({
        id: lookbook.id,
        title,
        slug,
        season,
        description: description || undefined,
        heroImage,
        status,
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert(res.error.message || 'Failed to save settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Add Slide
  const handleAddSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlideUrl || !newSlideAlt) return;

    setIsAddingSlide(true);
    try {
      const res = await addSlideAction({
        lookbookId: lookbook.id,
        imageUrl: newSlideUrl,
        imageAlt: newSlideAlt,
        title: newSlideTitle || undefined,
        caption: newSlideCaption || undefined,
        sortOrder: lookbook.slides.length,
      });

      if (res.ok) {
        setIsAddSlideOpen(false);
        setNewSlideUrl('');
        setNewSlideAlt('');
        setNewSlideTitle('');
        setNewSlideCaption('');
        setActiveSlideIndex(lookbook.slides.length);
        router.refresh();
      } else {
        alert(res.error.message || 'Failed to add slide');
      }
    } finally {
      setIsAddingSlide(false);
    }
  };

  // Delete Slide
  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm('Are you sure you want to remove this frame?')) return;
    const res = await deleteSlideAction(slideId, lookbook.id);
    if (res.ok) {
      setActiveSlideIndex(Math.max(0, activeSlideIndex - 1));
      router.refresh();
    } else {
      alert(res.error.message || 'Failed to delete frame');
    }
  };

  // Image Click Handler to place Hotspot Pin
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;

    setPendingHotspotCoord({ x, y });
    handleSearchProducts('');
  };

  // Search Catalog Products
  const handleSearchProducts = async (q: string) => {
    setProductSearchQuery(q);
    setIsSearchingProducts(true);
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
      setIsSearchingProducts(false);
    }
  };

  // Select Product and Create Hotspot
  const handleSelectProduct = async (product: ProductSummaryForHotspot) => {
    if (!activeSlide || !pendingHotspotCoord) return;

    setIsAddingHotspot(true);
    try {
      const res = await addHotspotAction({
        slideId: activeSlide.id,
        productId: product.id,
        x: pendingHotspotCoord.x,
        y: pendingHotspotCoord.y,
        label: product.title,
      });

      if (res.ok) {
        setPendingHotspotCoord(null);
        router.refresh();
      } else {
        alert(res.error.message || 'Failed to attach hotspot');
      }
    } finally {
      setIsAddingHotspot(false);
    }
  };

  // Delete Hotspot
  const handleDeleteHotspot = async (hotspotId: string) => {
    const res = await deleteHotspotAction(hotspotId, lookbook.id);
    if (res.ok) {
      router.refresh();
    } else {
      alert(res.error.message || 'Failed to delete hotspot');
    }
  };

  return (
    <div className="space-y-8">
      {/* Settings Panel */}
      <div className="rounded-xs border border-line bg-page p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h2 className="type-title-md font-serif text-fg">Lookbook Configuration</h2>
            <p className="type-caption text-fg-muted">
              Define seasonal metadata, editorial cover image, and publication status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {status === 'published' && (
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/lookbook/${slug}`} target="_blank">
                  <ExternalLink size={13} className="mr-1.5" />
                  <span>Storefront</span>
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={handleSaveSettings} disabled={isSaving}>
              <Save size={13} className="mr-1.5" />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block type-caption font-medium text-fg">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">Season</label>
            <input
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">Status</label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'draft' | 'published' | 'scheduled' | 'archived')
              }
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block type-caption font-medium text-fg">Cover Hero Image URL</label>
            <input
              type="text"
              value={heroImage}
              onChange={(e) => setHeroImage(e.target.value)}
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block type-caption font-medium text-fg">Curatorial Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xs border border-line bg-raised/40 px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Frame Studio & Hotspot Mapper */}
      <div className="rounded-xs border border-line bg-page p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="type-title-md font-serif text-fg">Editorial Frames &amp; Hotspots</h3>
            <p className="type-caption text-fg-muted">
              Select a frame and click anywhere on the image to place a shoppable garment pin.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setIsAddSlideOpen(true)}>
            <Plus size={13} className="mr-1.5" />
            <span>Add Frame</span>
          </Button>
        </div>

        {/* Frame Tabs */}
        {lookbook.slides.length > 0 && (
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2">
            {lookbook.slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveSlideIndex(idx)}
                className={`flex items-center gap-2 rounded-xs border px-3 py-1.5 type-caption font-mono whitespace-nowrap transition-colors ${
                  activeSlideIndex === idx
                    ? 'border-accent-text bg-accent-text/10 font-medium text-accent-text'
                    : 'border-line bg-raised/40 text-fg-muted hover:text-fg'
                }`}
              >
                <Layers size={12} />
                <span>Frame {idx + 1}</span>
                <span className="rounded-xs bg-page px-1 text-fg-muted">
                  {s.hotspots.length} {s.hotspots.length === 1 ? 'pin' : 'pins'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Selected Frame Workspace */}
        {activeSlide ? (
          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Interactive Image Canvas */}
            <div className="lg:col-span-7">
              <div
                role="button"
                tabIndex={0}
                onClick={handleCanvasClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setPendingHotspotCoord({ x: 50, y: 50 });
                    handleSearchProducts('');
                  }
                }}
                className="shadow-xs relative mx-auto aspect-4/5 max-w-md cursor-crosshair overflow-hidden rounded-xs border border-line bg-raised"
              >
                <Image
                  src={activeSlide.imageUrl}
                  alt={activeSlide.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 450px"
                  className="pointer-events-none object-cover"
                />

                {/* Hotspot Pins Placed */}
                {activeSlide.hotspots.map((h, i) => (
                  <div
                    key={h.id}
                    style={{ left: `${h.x}%`, top: `${h.y}%` }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                  >
                    <div className="border-white shadow-md flex size-7 items-center justify-center rounded-full border bg-ink type-caption font-mono text-ivory">
                      {i + 1}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center type-caption font-mono text-accent-text">
                Click anywhere on the image above to place a new garment hotspot pin
              </p>
            </div>

            {/* Frame Details & Hotspots List */}
            <div className="flex flex-col lg:col-span-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h4 className="type-body-sm font-medium text-fg">
                  {activeSlide.title || `Frame ${activeSlideIndex + 1}`}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSlide(activeSlide.id)}
                  className="h-7 text-xs text-danger hover:bg-danger/10"
                >
                  <Trash2 size={12} className="mr-1" />
                  <span>Remove Frame</span>
                </Button>
              </div>

              {activeSlide.caption && (
                <p className="mt-2 type-caption font-serif text-fg-muted italic">
                  &ldquo;{activeSlide.caption}&rdquo;
                </p>
              )}

              {/* Hotspot Pins on this frame */}
              <div className="mt-6 flex-1 space-y-3">
                <span className="type-caption font-mono tracking-wider text-fg-muted uppercase">
                  Shoppable Pins ({activeSlide.hotspots.length})
                </span>

                {activeSlide.hotspots.length === 0 ? (
                  <div className="rounded-xs border border-line bg-raised/20 p-6 text-center text-fg-muted">
                    <Sparkles size={18} className="mx-auto text-accent-text opacity-60" />
                    <p className="mt-2 type-caption">No garment pins placed on this frame yet.</p>
                    <p className="mt-1 type-caption font-mono text-fg-muted">
                      Click the photo on the left to pin an item.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSlide.hotspots.map((h, i) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between gap-3 rounded-xs border border-line bg-page p-2.5 transition-colors hover:bg-raised/30"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink type-caption font-mono text-ivory">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="line-clamp-1 type-body-sm font-medium text-fg">
                              {h.label || h.product.title}
                            </p>
                            <div className="flex items-center gap-2 type-caption font-mono text-fg-muted">
                              <span>
                                ({h.x}%, {h.y}%)
                              </span>
                              {h.product.priceMinor !== null && (
                                <span>• {formatPriceText(money(h.product.priceMinor, 'BDT'))}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHotspot(h.id)}
                          className="size-7 p-0 text-danger hover:bg-danger/10"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-xs border border-line bg-raised/20 p-12 text-center text-fg-muted">
            <Layers size={24} className="mx-auto text-fg-muted" />
            <p className="mt-2 type-body-sm">No frames added to this lookbook yet.</p>
            <div className="mt-4">
              <Button size="sm" onClick={() => setIsAddSlideOpen(true)}>
                <Plus size={13} className="mr-1.5" />
                <span>Add First Frame</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Frame Modal */}
      <Dialog open={isAddSlideOpen} onOpenChange={setIsAddSlideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="type-title-md font-serif">Add Editorial Frame</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddSlide} className="mt-4 space-y-4">
            <div>
              <label className="block type-caption font-medium text-fg">Image URL *</label>
              <input
                type="text"
                required
                value={newSlideUrl}
                onChange={(e) => setNewSlideUrl(e.target.value)}
                placeholder="/editorial/craft.jpg or https://..."
                className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block type-caption font-medium text-fg">Image Alt Text *</label>
              <input
                type="text"
                required
                value={newSlideAlt}
                onChange={(e) => setNewSlideAlt(e.target.value)}
                placeholder="Tactile study of woven Irish linen"
                className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block type-caption font-medium text-fg">
                Frame Title (Optional)
              </label>
              <input
                type="text"
                value={newSlideTitle}
                onChange={(e) => setNewSlideTitle(e.target.value)}
                placeholder="e.g. Frame II — The Tactile Study"
                className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block type-caption font-medium text-fg">
                Styling Narrative / Caption (Optional)
              </label>
              <textarea
                rows={2}
                value={newSlideCaption}
                onChange={(e) => setNewSlideCaption(e.target.value)}
                placeholder="Single-needle 22-stitch precision balancing natural slub with crisp collar discipline."
                className="mt-1 w-full rounded-xs border border-line bg-page px-3 py-2 text-xs text-fg focus:border-accent-text focus:outline-hidden"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsAddSlideOpen(false)}
                disabled={isAddingSlide}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isAddingSlide}>
                {isAddingSlide ? 'Adding...' : 'Add Frame'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product Search & Attach Hotspot Modal */}
      <Dialog
        open={Boolean(pendingHotspotCoord)}
        onOpenChange={(open) => !open && setPendingHotspotCoord(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="type-title-md font-serif">
              Attach Garment Pin ({pendingHotspotCoord?.x}%, {pendingHotspotCoord?.y}%)
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search size={14} className="absolute top-2.5 left-3 text-fg-muted" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => handleSearchProducts(e.target.value)}
                placeholder="Search products by title, slug, or fabric..."
                className="w-full rounded-xs border border-line bg-page py-2 pr-3 pl-9 text-xs text-fg focus:border-accent-text focus:outline-hidden"
              />
            </div>

            <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-xs border border-line">
              {isSearchingProducts ? (
                <div className="py-8 text-center type-caption text-fg-muted">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center type-caption text-fg-muted">
                  No products found.
                </div>
              ) : (
                searchResults.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod)}
                    disabled={isAddingHotspot}
                    className="flex w-full items-center justify-between gap-3 p-2.5 text-left transition-colors hover:bg-raised/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {prod.primaryImage ? (
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-xs bg-raised">
                          <Image
                            src={prod.primaryImage}
                            alt={prod.title}
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
                        <p className="line-clamp-1 type-body-sm font-medium text-fg">
                          {prod.title}
                        </p>
                        <p className="type-caption font-mono text-fg-muted">
                          {prod.material || prod.slug}
                        </p>
                      </div>
                    </div>

                    {prod.priceMinor !== null && (
                      <span className="shrink-0 type-caption font-mono font-medium text-fg">
                        {formatPriceText(money(prod.priceMinor, 'BDT'))}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
