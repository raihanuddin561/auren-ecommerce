'use client';

import {
  ArrowDown,
  ArrowUp,
  Eye,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Settings2,
  ShoppingBag,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ChangeEvent } from 'react';
import { failureMessage } from '@/components/admin/action-feedback';
import { FormActions, FormSection } from '@/components/admin/form-section';
import { shrinkForUpload } from '@/components/admin/shrink-image';
import { HeroCarousel } from '@/components/storefront/home/hero-carousel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import {
  saveHeroCarouselSettingsAction,
  uploadHeroSlideImageAction,
} from '@/modules/settings/actions';
import {
  DEFAULT_HERO_SLIDES,
  type HeroCarouselSettings,
  type HeroSlide,
} from '@/modules/settings/schemas';
import { ProductSelectModal, type SelectedProductData } from './product-select-modal';

interface CarouselSettingsManagerProps {
  initialSettings: HeroCarouselSettings;
}

export function CarouselSettingsManager({ initialSettings }: CarouselSettingsManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  const [autoplay, setAutoplay] = useState(initialSettings.autoplay);
  const [autoplaySeconds, setAutoplaySeconds] = useState(
    Math.round(initialSettings.autoplayInterval / 1000) || 6,
  );
  const [slides, setSlides] = useState<HeroSlide[]>(initialSettings.slides);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [targetSlideIndex, setTargetSlideIndex] = useState<number | null>(null);

  function openAddFromProduct() {
    setTargetSlideIndex(null);
    setProductModalOpen(true);
  }

  function openPickForSlide(index: number) {
    setTargetSlideIndex(index);
    setProductModalOpen(true);
  }

  function handleProductSelected(product: SelectedProductData) {
    if (targetSlideIndex !== null) {
      updateSlide(targetSlideIndex, {
        imageUrl: product.imageUrl || '/seed/charcoal.svg',
        imageAlt: product.title,
        primaryCtaLink: `/products/${product.slug}`,
        imageFit: 'contain',
        ...(slides[targetSlideIndex]?.title.includes('New Season') ||
        slides[targetSlideIndex]?.title.includes('Campaign')
          ? {
              title: product.title,
              eyebrow: 'FEATURED PIECE',
              description:
                product.subtitle || 'Crafted with premium natural fibers and timeless tailoring.',
              primaryCtaText: 'Shop this piece',
            }
          : {}),
      });
      toast.success(`Applied imagery and link for "${product.title}"`);
      setTargetSlideIndex(null);
    } else {
      const newId = `slide-${Date.now()}`;
      const newSlide: HeroSlide = {
        id: newId,
        eyebrow: 'FEATURED PIECE',
        title: product.title,
        description:
          product.subtitle || 'Crafted with premium natural fibers and timeless tailoring.',
        primaryCtaText: 'Shop this piece',
        primaryCtaLink: `/products/${product.slug}`,
        secondaryCtaText: 'View Lookbook',
        secondaryCtaLink: '/shop',
        imageUrl: product.imageUrl || '/seed/charcoal.svg',
        imageAlt: product.title,
        overlayOpacity: 25,
        textAlignment: 'left',
        imageFit: 'contain',
        active: true,
        sortOrder: slides.length,
      };
      setSlides((prev) => [...prev, newSlide]);
      toast.success(`Added slide for "${product.title}"`);
    }
  }

  // Slide mutations
  function addSlide() {
    const newId = `slide-${Date.now()}`;
    const newSlide: HeroSlide = {
      id: newId,
      eyebrow: 'NEW COLLECTION',
      title: 'New Season Campaign',
      description: 'Discover the latest tailoring and refined essentials for the modern gentleman.',
      primaryCtaText: 'Shop the collection',
      primaryCtaLink: '/shop',
      secondaryCtaText: '',
      secondaryCtaLink: '',
      imageUrl: '/seed/charcoal.svg',
      imageAlt: 'Campaign menswear photo',
      overlayOpacity: 25,
      textAlignment: 'left',
      imageFit: 'contain',
      active: true,
      sortOrder: slides.length,
    };
    setSlides((prev) => [...prev, newSlide]);
    toast.success('Slide added');
  }

  function removeSlide(index: number) {
    if (slides.length <= 1) {
      toast.error('The carousel must have at least one slide.');
      return;
    }
    setSlides((prev) => prev.filter((_, i) => i !== index));
    toast.success('Slide removed');
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSlides((prev) => {
      const copy = [...prev];
      const target = copy[index]!;
      copy[index] = copy[index - 1]!;
      copy[index - 1] = target;
      return copy.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }

  function moveDown(index: number) {
    if (index === slides.length - 1) return;
    setSlides((prev) => {
      const copy = [...prev];
      const target = copy[index]!;
      copy[index] = copy[index + 1]!;
      copy[index + 1] = target;
      return copy.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }

  function updateSlide(index: number, patch: Partial<HeroSlide>) {
    setSlides((prev) => prev.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)));
  }

  function resetToDefaults() {
    if (window.confirm('Reset all slides to the brand defaults?')) {
      setSlides([...DEFAULT_HERO_SLIDES]);
      setAutoplay(true);
      setAutoplaySeconds(6);
      toast.success('Reset to brand defaults');
    }
  }

  async function handleFileUpload(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingIndex(index);
    try {
      const shrunk = await shrinkForUpload(file);
      const form = new FormData();
      form.set('file', shrunk);

      const res = await uploadHeroSlideImageAction(form);
      if (!res.ok) {
        toast.error(failureMessage(res) ?? 'Failed to upload image.');
      } else {
        updateSlide(index, { imageUrl: res.data.url });
        toast.success('Image uploaded successfully');
      }
    } catch {
      toast.error('Upload failed. Check file size and network connection.');
    } finally {
      setUploadingIndex(null);
    }
  }

  function onSave() {
    startTransition(async () => {
      const payload: HeroCarouselSettings = {
        autoplay,
        autoplayInterval: Math.max(2, Math.min(20, autoplaySeconds)) * 1000,
        slides: slides.map((s, i) => ({ ...s, sortOrder: i })),
      };

      const result = await saveHeroCarouselSettingsAction(payload);
      if (!result.ok) {
        toast.error(failureMessage(result) ?? 'Could not save carousel settings.');
        return;
      }

      toast.success('Hero carousel updated successfully');
      router.refresh();
    });
  }

  const previewSettings: HeroCarouselSettings = {
    autoplay,
    autoplayInterval: Math.max(2, Math.min(20, autoplaySeconds)) * 1000,
    slides: slides.filter((s) => s.active).length > 0 ? slides.filter((s) => s.active) : slides,
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Top action tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={activeTab === 'editor' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('editor')}
          >
            <Icon icon={Settings2} size={16} className="mr-1.5" />
            Configure Slides ({slides.length})
          </Button>
          <Button
            type="button"
            variant={activeTab === 'preview' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveTab('preview')}
          >
            <Icon icon={Eye} size={16} className="mr-1.5" />
            Live Preview
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            disabled={pending}
          >
            <Icon icon={RotateCcw} size={16} className="mr-1.5" />
            Reset Defaults
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openAddFromProduct}
            disabled={pending}
          >
            <Icon icon={ShoppingBag} size={16} className="mr-1.5" />
            Add from Product
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={addSlide} disabled={pending}>
            <Icon icon={Plus} size={16} className="mr-1.5" />
            Add Blank Slide
          </Button>
        </div>
      </div>

      {activeTab === 'preview' ? (
        /* Live Storefront Carousel Preview */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xs border border-line bg-raised p-4">
            <div>
              <h3 className="type-h3 text-fg">Storefront Live Preview</h3>
              <p className="type-small text-fg-muted">
                How visitors will experience the hero carousel on the storefront homepage.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('editor')}
            >
              Return to editor
            </Button>
          </div>
          <div className="relative overflow-hidden border border-line shadow-float">
            <HeroCarousel settings={previewSettings} />
          </div>
        </div>
      ) : (
        /* Editor Mode */
        <div className="flex flex-col gap-10">
          {/* General Carousel Controls */}
          <FormSection
            title="Playback & Timings"
            description="Control automatic slide cycling and transition timing."
          >
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <p className="type-admin font-medium text-fg">Autoplay Slides</p>
                  <p className="type-small text-fg-muted">
                    Automatically advance through campaign slides. Pauses on hover or user
                    interaction.
                  </p>
                </div>
                <Switch
                  checked={autoplay}
                  onCheckedChange={setAutoplay}
                  label={<span className="sr-only">Autoplay slides</span>}
                />
              </div>

              {autoplay ? (
                <FormField
                  label="Slide display duration (seconds)"
                  hint="Recommended: 5 to 8 seconds for luxury editorial reading."
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={2}
                      max={20}
                      value={autoplaySeconds}
                      onChange={(e) => setAutoplaySeconds(Number(e.target.value) || 6)}
                      className="max-w-xs"
                    />
                  )}
                </FormField>
              ) : null}
            </div>
          </FormSection>

          {/* Slides List */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="type-h3 text-fg">Hero Slides</h2>
                <p className="type-admin text-fg-muted">
                  Reorder, customize messaging, campaign images, and call-to-actions.
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addSlide}>
                <Icon icon={Plus} size={16} className="mr-1.5" />
                Add Slide
              </Button>
            </div>

            {slides.map((slide, index) => {
              const isFirst = index === 0;
              const isLast = index === slides.length - 1;
              const isUploading = uploadingIndex === index;

              return (
                <div
                  key={slide.id}
                  className="flex flex-col border border-line bg-raised transition-all"
                >
                  {/* Slide Card Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-page/60 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="type-small font-mono text-fg-muted">#{index + 1}</span>
                      <span className="type-admin font-medium text-fg">
                        {slide.title || 'Untitled Slide'}
                      </span>
                      <Badge tone={slide.active ? 'gold' : 'neutral'}>
                        {slide.active ? 'Active on Store' : 'Hidden'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => moveUp(index)}
                        aria-label="Move slide up"
                        className="flex size-8 items-center justify-center border border-line bg-raised text-fg-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-30"
                      >
                        <Icon icon={ArrowUp} size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveDown(index)}
                        aria-label="Move slide down"
                        className="flex size-8 items-center justify-center border border-line bg-raised text-fg-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-30"
                      >
                        <Icon icon={ArrowDown} size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSlide(index)}
                        aria-label="Delete slide"
                        className="flex size-8 items-center justify-center border border-line bg-raised text-danger-text transition-colors hover:border-danger hover:bg-danger/10"
                      >
                        <Icon icon={Trash2} size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Slide Content Fields */}
                  <div className="grid gap-6 p-5 md:grid-cols-12 md:p-6">
                    {/* Left Column: Copy & Links */}
                    <div className="flex flex-col gap-4 md:col-span-7">
                      <FormField label="Eyebrow text" hint="Small uppercase accent above headline.">
                        {(control) => (
                          <Input
                            {...control}
                            value={slide.eyebrow}
                            maxLength={100}
                            placeholder="e.g. NEW SEASON / 2026"
                            onChange={(e) => updateSlide(index, { eyebrow: e.target.value })}
                          />
                        )}
                      </FormField>

                      <FormField
                        label="Headline / Title"
                        hint="Display font headline shown on slide."
                        required
                      >
                        {(control) => (
                          <Input
                            {...control}
                            value={slide.title}
                            maxLength={200}
                            placeholder="e.g. Modern, refined menswear"
                            onChange={(e) => updateSlide(index, { title: e.target.value })}
                          />
                        )}
                      </FormField>

                      <FormField label="Description body" hint="Editorial subtitle / body copy.">
                        {(control) => (
                          <textarea
                            {...control}
                            rows={3}
                            value={slide.description}
                            maxLength={500}
                            placeholder="Brief description of the collection or campaign..."
                            onChange={(e) => updateSlide(index, { description: e.target.value })}
                            className="w-full border border-line bg-page p-3 type-admin text-fg transition-colors outline-none focus:border-fg"
                          />
                        )}
                      </FormField>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Primary button label">
                          {(control) => (
                            <Input
                              {...control}
                              value={slide.primaryCtaText}
                              placeholder="e.g. Explore the collection"
                              onChange={(e) =>
                                updateSlide(index, { primaryCtaText: e.target.value })
                              }
                            />
                          )}
                        </FormField>
                        <FormField label="Primary button link (Product or Shop URL)">
                          {(control) => (
                            <div className="flex flex-col gap-1.5">
                              <Input
                                {...control}
                                value={slide.primaryCtaLink}
                                placeholder="e.g. /products/oxford-button-down-shirt or /shop"
                                onChange={(e) =>
                                  updateSlide(index, { primaryCtaLink: e.target.value })
                                }
                              />
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="type-caption text-[11px] text-fg-muted">
                                  Quick presets:
                                </span>
                                {[
                                  '/shop',
                                  '/shop?sort=newest',
                                  '/collections/the-summer-edit',
                                  '/collections/winter-layers',
                                ].map((quickLink) => (
                                  <button
                                    key={quickLink}
                                    type="button"
                                    onClick={() =>
                                      updateSlide(index, { primaryCtaLink: quickLink })
                                    }
                                    className="rounded-xs border border-line bg-page px-1.5 py-0.5 text-[10px] text-fg-muted hover:border-fg hover:text-fg"
                                  >
                                    {quickLink}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </FormField>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Secondary button label (Optional)">
                          {(control) => (
                            <Input
                              {...control}
                              value={slide.secondaryCtaText ?? ''}
                              placeholder="e.g. View Lookbook"
                              onChange={(e) =>
                                updateSlide(index, { secondaryCtaText: e.target.value })
                              }
                            />
                          )}
                        </FormField>
                        <FormField label="Secondary button link (Optional)">
                          {(control) => (
                            <Input
                              {...control}
                              value={slide.secondaryCtaLink ?? ''}
                              placeholder="e.g. /collections"
                              onChange={(e) =>
                                updateSlide(index, { secondaryCtaLink: e.target.value })
                              }
                            />
                          )}
                        </FormField>
                      </div>
                    </div>

                    {/* Right Column: Visuals, Alignment, Overlay */}
                    <div className="flex flex-col gap-4 border-t border-line pt-4 md:col-span-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                      <div>
                        <p className="type-small font-medium text-fg">Campaign Imagery</p>
                        <div className="mt-2 flex gap-4">
                          {/* Image preview box */}
                          <div className="relative aspect-[16/9] w-40 overflow-hidden border border-line bg-page">
                            {slide.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={slide.imageUrl}
                                alt={slide.imageAlt || 'Slide preview'}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-fg-muted">
                                <Icon icon={ImageIcon} size={24} />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col justify-center gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => openPickForSlide(index)}
                                disabled={isUploading}
                              >
                                <Icon icon={ShoppingBag} size={14} className="mr-1.5" />
                                Pick from Product
                              </Button>
                              <label className="inline-flex cursor-pointer">
                                <span className="inline-flex items-center border border-line bg-page px-3 py-1.5 type-small text-fg transition-colors hover:border-fg">
                                  <Icon icon={Upload} size={14} className="mr-1.5" />
                                  {isUploading ? 'Uploading...' : 'Upload Image'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/avif"
                                  onChange={(e) => handleFileUpload(index, e)}
                                  disabled={isUploading}
                                  className="sr-only"
                                />
                              </label>
                            </div>
                            <span className="type-small text-fg-muted">
                              Select from catalog, upload a file (10MB), or enter an image URL
                              below.
                            </span>
                          </div>
                        </div>
                      </div>

                      <FormField label="Image URL or Path">
                        {(control) => (
                          <Input
                            {...control}
                            value={slide.imageUrl}
                            placeholder="/seed/charcoal.svg or https://..."
                            onChange={(e) => updateSlide(index, { imageUrl: e.target.value })}
                          />
                        )}
                      </FormField>

                      <FormField label="Image Alt text" hint="Describe for accessibility.">
                        {(control) => (
                          <Input
                            {...control}
                            value={slide.imageAlt}
                            placeholder="e.g. Charcoal tailored suit"
                            onChange={(e) => updateSlide(index, { imageAlt: e.target.value })}
                          />
                        )}
                      </FormField>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField label="Text alignment">
                          {() => (
                            <div className="flex border border-line bg-page">
                              {(['left', 'center', 'right'] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSlide(index, { textAlignment: align })}
                                  className={cn(
                                    'flex-1 py-1.5 text-center type-small capitalize transition-colors',
                                    slide.textAlignment === align
                                      ? 'bg-fg font-medium text-page'
                                      : 'text-fg-muted hover:text-fg',
                                  )}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          )}
                        </FormField>

                        <FormField
                          label={`Dark overlay (${slide.overlayOpacity ?? 25}%)`}
                          hint="Vignette opacity"
                        >
                          {(control) => (
                            <input
                              {...control}
                              type="range"
                              min={0}
                              max={80}
                              step={5}
                              value={slide.overlayOpacity ?? 25}
                              onChange={(e) =>
                                updateSlide(index, { overlayOpacity: Number(e.target.value) })
                              }
                              className="mt-2 w-full cursor-pointer accent-gold"
                            />
                          )}
                        </FormField>
                      </div>

                      <FormField
                        label="Image Sizing & Fit"
                        hint="Choose how the photography fits in the slider."
                      >
                        {() => (
                          <div className="flex border border-line bg-page">
                            <button
                              type="button"
                              onClick={() => updateSlide(index, { imageFit: 'contain' })}
                              className={cn(
                                'flex-1 px-2 py-1.5 text-center type-small transition-colors',
                                (slide.imageFit ?? 'contain') === 'contain'
                                  ? 'bg-fg font-medium text-page'
                                  : 'text-fg-muted hover:text-fg',
                              )}
                            >
                              Fit Entire Image (Showcase)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSlide(index, { imageFit: 'cover' })}
                              className={cn(
                                'flex-1 px-2 py-1.5 text-center type-small transition-colors',
                                slide.imageFit === 'cover'
                                  ? 'bg-fg font-medium text-page'
                                  : 'text-fg-muted hover:text-fg',
                              )}
                            >
                              Full-Bleed Cover
                            </button>
                          </div>
                        )}
                      </FormField>

                      <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-3">
                        <span className="type-small font-medium text-fg">Active on Storefront</span>
                        <Switch
                          checked={slide.active}
                          onCheckedChange={(checked) => updateSlide(index, { active: checked })}
                          label={<span className="sr-only">Active on Storefront</span>}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Form Actions */}
          <FormActions>
            <div className="flex w-full items-center justify-between">
              <span className="type-small text-fg-muted">
                {slides.filter((s) => s.active).length} of {slides.length} slides active
              </span>
              <Button type="button" variant="primary" loading={pending} onClick={onSave}>
                Save Carousel Settings
              </Button>
            </div>
          </FormActions>
        </div>
      )}

      {/* Product selection modal for recorded catalog pieces */}
      <ProductSelectModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        onSelectProduct={handleProductSelected}
        title={
          targetSlideIndex !== null
            ? `Select Product for Slide ${targetSlideIndex + 1}`
            : 'Add Slide from Recorded Product'
        }
        description={
          targetSlideIndex !== null
            ? 'Choose an existing catalog product to apply its recorded photography and direct product URL to this slide.'
            : 'Choose an existing catalog product to create a new campaign slide with its photography and shop link.'
        }
      />
    </div>
  );
}
