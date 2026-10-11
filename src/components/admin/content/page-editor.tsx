'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  deletePageSectionAction,
  reorderPageSectionsAction,
  updatePageAction,
  updatePageSectionAction,
} from '@/modules/content/actions';
import type { PageDetail, PageSectionItem, PageStatus } from '@/modules/content/types';
import { SectionRenderer } from '@/components/content/section-renderer';
import { SectionEditorDialog } from './section-editor-dialog';
import {
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  Save,
  Layers,
  Sparkles,
  Monitor,
  Tablet,
  Smartphone,
  Globe,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface PageEditorProps {
  initialPage: PageDetail;
}

type TabMode = 'blocks' | 'preview' | 'settings';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export function PageEditor({ initialPage }: PageEditorProps) {
  const router = useRouter();
  const [page, setPage] = useState<PageDetail>(initialPage);
  const [activeTab, setActiveTab] = useState<TabMode>('blocks');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [isSavingPage, setIsSavingPage] = useState(false);

  // Form states
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [description, setDescription] = useState(page.description ?? '');
  const [status, setStatus] = useState<PageStatus>(page.status);
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? '');
  const [ogImageUrl, setOgImageUrl] = useState(page.ogImageUrl ?? '');

  const handleQuickStatusToggle = async () => {
    const nextStatus: PageStatus = status === 'published' ? 'draft' : 'published';
    setIsSavingPage(true);
    try {
      const res = await updatePageAction({
        id: page.id,
        status: nextStatus,
      });

      if (!res.ok) {
        toast.error(res.error.message ?? 'Failed to update status');
        return;
      }

      setStatus(nextStatus);
      setPage((prev) => ({ ...prev, status: nextStatus }));
      toast.success(nextStatus === 'published' ? 'Page is now LIVE' : 'Page reverted to DRAFT');
      router.refresh();
    } catch {
      toast.error('Unexpected error toggling status');
    } finally {
      setIsSavingPage(false);
    }
  };

  const handleSavePageSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPage(true);

    try {
      const res = await updatePageAction({
        id: page.id,
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        status,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        ogImageUrl: ogImageUrl.trim() || null,
      });

      if (!res.ok) {
        toast.error(res.error.message ?? 'Failed to update page');
        return;
      }

      setPage((prev) => ({
        ...prev,
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        status,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        ogImageUrl: ogImageUrl.trim() || null,
      }));

      toast.success('Page details saved');
      router.refresh();
    } catch {
      toast.error('Unexpected error saving page');
    } finally {
      setIsSavingPage(false);
    }
  };

  const handleToggleVisibility = async (section: PageSectionItem) => {
    try {
      const res = await updatePageSectionAction({
        id: section.id,
        isVisible: !section.isVisible,
      });

      if (!res.ok) {
        toast.error('Failed to toggle visibility');
        return;
      }

      setPage((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === section.id ? { ...s, isVisible: !s.isVisible } : s,
        ),
      }));

      toast.success(section.isVisible ? 'Section hidden' : 'Section visible');
      router.refresh();
    } catch {
      toast.error('Error toggling visibility');
    }
  };

  const handleDeleteSection = async (section: PageSectionItem) => {
    if (!confirm(`Delete section "${section.name || section.blockType}"?`)) return;

    try {
      const res = await deletePageSectionAction(section.id, page.id);
      if (!res.ok) {
        toast.error(res.error.message ?? 'Failed to delete section');
        return;
      }

      setPage((prev) => ({
        ...prev,
        sections: prev.sections.filter((s) => s.id !== section.id),
      }));

      toast.success('Section deleted');
      router.refresh();
    } catch {
      toast.error('Error deleting section');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const sections = [...page.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const [moved] = sections.splice(index, 1);
    if (!moved) return;
    sections.splice(targetIndex, 0, moved);

    setPage((prev) => ({ ...prev, sections }));

    try {
      const sectionIds = sections.map((s) => s.id);
      const res = await reorderPageSectionsAction({
        pageId: page.id,
        sectionIds,
      });

      if (!res.ok) {
        toast.error('Failed to save order');
        router.refresh();
        return;
      }

      toast.success('Block order updated');
    } catch {
      toast.error('Error reordering blocks');
      router.refresh();
    }
  };

  const getStatusTone = (s: PageStatus) => {
    switch (s) {
      case 'published':
        return 'success';
      case 'draft':
        return 'neutral';
      case 'scheduled':
        return 'gold';
      case 'archived':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-sm border border-line bg-raised p-5 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-xl font-semibold text-fg">{page.title}</h1>
            <Badge tone={getStatusTone(status)} className="capitalize">
              {status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-fg-muted">
            <span>
              Route: <strong className="text-fg">/pages/{page.slug}</strong>
            </span>
            <span className="text-line">•</span>
            <span>{page.sections.length} Section Blocks</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Publish / Unpublish Toggle */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleQuickStatusToggle}
            disabled={isSavingPage}
            className="text-xs"
          >
            {status === 'published' ? (
              'Revert to Draft'
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success-text" /> Publish Live
              </>
            )}
          </Button>

          {/* View Public Storefront */}
          <Button asChild variant="secondary" size="sm" className="gap-1.5 text-xs">
            <Link href={`/pages/${page.slug}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              Live Storefront
            </Link>
          </Button>

          {/* Add Section Dialog */}
          <SectionEditorDialog
            pageId={page.id}
            onSuccess={() => {
              router.refresh();
            }}
          />
        </div>
      </div>

      {/* Studio Navigation Tabs */}
      <div className="flex border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab('blocks')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-medium transition-colors ${
            activeTab === 'blocks'
              ? 'border-gold text-fg'
              : 'border-transparent text-fg-muted hover:text-fg'
          }`}
        >
          <Layers className="h-4 w-4" />
          Blocks & Layout ({page.sections.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-medium transition-colors ${
            activeTab === 'preview'
              ? 'border-gold text-fg'
              : 'border-transparent text-fg-muted hover:text-fg'
          }`}
        >
          <Globe className="h-4 w-4" />
          Live Visual Preview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-gold text-fg'
              : 'border-transparent text-fg-muted hover:text-fg'
          }`}
        >
          <Settings className="h-4 w-4" />
          SEO & Page Settings
        </button>
      </div>

      {/* ========================================================================================= */}
      {/* TAB 1: BLOCKS & LAYOUT */}
      {/* ========================================================================================= */}
      {activeTab === 'blocks' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-semibold text-fg">Page Section Blocks</h2>
                <span className="text-xs text-fg-muted">({page.sections.length} blocks)</span>
              </div>
              <SectionEditorDialog
                pageId={page.id}
                trigger={
                  <Button variant="secondary" size="sm" className="text-xs">
                    + Add Block
                  </Button>
                }
                onSuccess={() => router.refresh()}
              />
            </div>

            {page.sections.length === 0 ? (
              <div className="space-y-3 rounded-sm border border-dashed border-line bg-page/40 p-12 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-fg-muted/50" />
                <p className="text-sm font-medium text-fg">No section blocks configured yet</p>
                <p className="mx-auto max-w-sm text-xs text-fg-muted">
                  Add a Hero Banner, Category Grid, Split Craftsmanship Banner, or Lookbook Strip to
                  begin designing this page.
                </p>
                <div className="pt-2">
                  <SectionEditorDialog pageId={page.id} onSuccess={() => router.refresh()} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {page.sections.map((section, index) => {
                  const props = (section.props ?? {}) as Record<string, unknown>;
                  const previewTitle =
                    section.name ||
                    (typeof props.headline === 'string' ? props.headline : null) ||
                    (typeof props.quote === 'string' ? props.quote : null) ||
                    section.blockType;
                  const subtitle = typeof props.subtitle === 'string' ? props.subtitle : null;

                  return (
                    <div
                      key={section.id}
                      className={`rounded-sm border p-4 transition-all ${
                        section.isVisible
                          ? 'border-line bg-raised'
                          : 'border-line/60 bg-page/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-xs border border-line bg-page font-mono text-xs text-fg-muted">
                            {index + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-fg">{previewTitle}</span>
                              <Badge tone="neutral">{section.blockType.replace(/_/g, ' ')}</Badge>
                              {!section.isVisible && <Badge tone="warning">Hidden</Badge>}
                            </div>
                            {subtitle && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">
                                {subtitle}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Block Action Controls */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'up')}
                            className="h-7 w-7 p-0 text-fg-muted hover:text-fg disabled:opacity-20"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === page.sections.length - 1}
                            onClick={() => handleMove(index, 'down')}
                            className="h-7 w-7 p-0 text-fg-muted hover:text-fg disabled:opacity-20"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleVisibility(section)}
                            className="h-7 w-7 p-0 text-fg-muted hover:text-fg"
                            title={section.isVisible ? 'Hide Section' : 'Show Section'}
                          >
                            {section.isVisible ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-warning" />
                            )}
                          </Button>

                          <SectionEditorDialog
                            pageId={page.id}
                            section={section}
                            onSuccess={() => router.refresh()}
                          />

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSection(section)}
                            className="h-7 w-7 p-0 text-fg-muted hover:text-danger-text"
                            title="Delete Section"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Summary Aside */}
          <div className="space-y-4">
            <div className="space-y-4 rounded-sm border border-line bg-raised p-5">
              <h3 className="text-xs font-semibold tracking-wider text-fg uppercase">
                Editor Studio Tips
              </h3>
              <ul className="space-y-2.5 text-xs text-fg-muted">
                <li className="flex items-start gap-2">
                  <span className="text-gold">•</span>
                  <span>
                    Use the <strong>Live Visual Preview</strong> tab to inspect changes across
                    Desktop, Tablet, and Mobile screens.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold">•</span>
                  <span>
                    When a <strong>Hero Banner</strong> is placed at the top, the storefront renders
                    an immersive full-bleed banner.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold">•</span>
                  <span>
                    Temporarily hide sections with the <strong>Eye</strong> button to test draft
                    configurations without deleting them.
                  </span>
                </li>
              </ul>
              <div className="border-t border-line pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab('preview')}
                  className="w-full gap-2 text-xs"
                >
                  <Globe className="h-3.5 w-3.5" /> Open Visual Preview
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* TAB 2: LIVE VISUAL PREVIEW STUDIO */}
      {/* ========================================================================================= */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          {/* Device Viewport Bar */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-sm border border-line bg-raised px-4 py-3 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-fg-muted">Preview Viewport:</span>
              <div className="flex items-center rounded-xs border border-line bg-page p-0.5">
                <button
                  type="button"
                  onClick={() => setDeviceMode('desktop')}
                  className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-colors ${
                    deviceMode === 'desktop' ? 'shadow-xs bg-raised text-fg' : 'text-fg-muted'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" /> Desktop (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('tablet')}
                  className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-colors ${
                    deviceMode === 'tablet' ? 'shadow-xs bg-raised text-fg' : 'text-fg-muted'
                  }`}
                >
                  <Tablet className="h-3.5 w-3.5" /> Tablet (768px)
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('mobile')}
                  className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-xs font-medium transition-colors ${
                    deviceMode === 'mobile' ? 'shadow-xs bg-raised text-fg' : 'text-fg-muted'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Mobile (390px)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-fg-muted">
              <span>https://aurenbd.shop/pages/{page.slug}</span>
              <Button asChild variant="ghost" size="sm" className="h-6 w-6 p-0 text-gold">
                <Link href={`/pages/${page.slug}`} target="_blank" title="Open new tab">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Device Mockup Frame */}
          <div className="flex justify-center rounded-sm border border-line bg-raised/30 p-4 md:p-8">
            <div
              className={`shadow-xl overflow-hidden rounded-sm border border-line bg-page transition-all duration-300 ${
                deviceMode === 'mobile'
                  ? 'w-[390px]'
                  : deviceMode === 'tablet'
                    ? 'w-[768px]'
                    : 'w-full max-w-6xl'
              }`}
            >
              {/* Browser Header Bar */}
              <div className="flex items-center gap-2 border-b border-line bg-raised/70 px-4 py-2">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-line" />
                  <span className="h-2.5 w-2.5 rounded-full bg-line" />
                  <span className="h-2.5 w-2.5 rounded-full bg-line" />
                </div>
                <div className="mx-auto flex max-w-sm flex-1 items-center justify-center rounded-xs bg-page px-3 py-1 font-mono text-xs text-fg-muted">
                  aurenbd.shop/pages/{page.slug}
                </div>
              </div>

              {/* Rendered Content Frame */}
              <div className="min-h-[500px] overflow-y-auto bg-page py-8">
                <SectionRenderer sections={page.sections.filter((s) => s.isVisible)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* TAB 3: PAGE & SEO SETTINGS */}
      {/* ========================================================================================= */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <form
            onSubmit={handleSavePageSettings}
            className="space-y-5 rounded-sm border border-line bg-raised p-6 lg:col-span-2"
          >
            <h2 className="text-sm font-semibold text-fg">Page Settings & Metadata</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs text-fg-muted">
                  Page Title *
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 border-line bg-page text-xs font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-xs text-fg-muted">
                  URL Route Slug *
                </Label>
                <div className="flex items-center rounded-sm border border-line bg-page px-3 font-mono text-xs text-fg-muted">
                  <span>/pages/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="h-8 border-0 bg-transparent px-1 font-mono text-xs text-fg shadow-none focus-visible:ring-0"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs text-fg-muted">
                  Publication Status
                </Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PageStatus)}
                  className="h-9 w-full rounded-sm border border-line bg-page px-3 text-xs text-fg focus:ring-1 focus:ring-gold focus:outline-hidden"
                >
                  <option value="draft">Draft — Private to staff only</option>
                  <option value="published">Published — Live on public storefront</option>
                  <option value="scheduled">Scheduled — Set for future activation</option>
                  <option value="archived">Archived — Deactivated</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-xs text-fg-muted">
                  Excerpt / Description
                </Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[70px] border-line bg-page text-xs"
                />
              </div>

              <div className="space-y-4 border-t border-line pt-4">
                <h3 className="text-xs font-semibold tracking-wider text-fg uppercase">
                  SEO & Social Sharing
                </h3>

                <div className="space-y-1.5">
                  <Label htmlFor="seoTitle" className="text-xs text-fg-muted">
                    Meta Title
                  </Label>
                  <Input
                    id="seoTitle"
                    placeholder="Page Title | AUREN"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    className="h-9 border-line bg-page text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="seoDesc" className="text-xs text-fg-muted">
                    Meta Description
                  </Label>
                  <Textarea
                    id="seoDesc"
                    placeholder="Search snippet description for search engines..."
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    className="min-h-[70px] border-line bg-page text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ogImage" className="text-xs text-fg-muted">
                    OpenGraph Image URL
                  </Label>
                  <Input
                    id="ogImage"
                    placeholder="https://..."
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    className="h-9 border-line bg-page font-mono text-xs"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={isSavingPage}
                className="gap-2 bg-ink text-xs text-ivory hover:bg-ink/90"
              >
                <Save className="h-3.5 w-3.5" />
                {isSavingPage ? 'Saving Settings...' : 'Save Page Settings'}
              </Button>
            </div>
          </form>

          {/* Search SERP Preview Card */}
          <div className="space-y-4 rounded-sm border border-line bg-raised p-5">
            <h3 className="text-xs font-semibold tracking-wider text-fg uppercase">
              Google Search Preview
            </h3>
            <div className="space-y-1 rounded-sm border border-line/60 bg-page p-4 text-left">
              <p className="font-mono text-xs text-fg-muted">https://aurenbd.shop/pages/{slug}</p>
              <h4 className="font-sans text-sm font-medium text-accent-text hover:underline">
                {seoTitle || `${title} | AUREN`}
              </h4>
              <p className="line-clamp-2 text-xs leading-relaxed text-fg-muted">
                {seoDescription ||
                  description ||
                  'Discover curated bespoke luxury menswear and master craftsmanship at AUREN.'}
              </p>
            </div>
            <p className="text-xs leading-relaxed text-fg-subtle">
              This snippet simulates how this landing page appears in search engine result pages.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
