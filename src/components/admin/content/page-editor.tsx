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
import { SectionEditorDialog } from './section-editor-dialog';
import {
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Save,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface PageEditorProps {
  initialPage: PageDetail;
}

export function PageEditor({ initialPage }: PageEditorProps) {
  const router = useRouter();
  const [page, setPage] = useState<PageDetail>(initialPage);
  const [isSavingPage, setIsSavingPage] = useState(false);

  // Form states
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [description, setDescription] = useState(page.description ?? '');
  const [status, setStatus] = useState<PageStatus>(page.status);
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? '');
  const [ogImageUrl, setOgImageUrl] = useState(page.ogImageUrl ?? '');

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

    setPage({ ...page, sections });

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

  return (
    <div className="space-y-8">
      {/* Top Header Bar */}
      <div className="bg-canvas flex flex-col justify-between gap-4 rounded-sm border border-line p-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl font-semibold text-ink">{page.title}</h1>
            <Badge
              tone={
                page.status === 'published'
                  ? 'success'
                  : page.status === 'scheduled'
                    ? 'gold'
                    : 'neutral'
              }
            >
              {page.status}
            </Badge>
          </div>
          <p className="text-stone font-mono text-xs">
            Public Route: <strong className="text-ink">/pages/{page.slug}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="gap-1.5 text-xs">
            <Link href={`/pages/${page.slug}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              Preview Live Page
            </Link>
          </Button>

          <SectionEditorDialog pageId={page.id} onSuccess={() => router.refresh()} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Section Blocks Builder */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-ink">Page Section Blocks</h2>
              <span className="text-stone text-xs">({page.sections.length} blocks)</span>
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
            <div className="bg-surface/20 space-y-3 rounded-sm border border-dashed border-line p-12 text-center">
              <Sparkles className="text-stone/50 mx-auto h-8 w-8" />
              <p className="text-sm font-medium text-ink">No section blocks configured yet</p>
              <p className="text-stone mx-auto max-w-sm text-xs">
                Add a Hero Banner, Editorial Quote, Brand Perks, or Lookbook Strip to begin
                designing this page.
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
                        ? 'bg-canvas border-line'
                        : 'bg-surface/40 border-line/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="bg-surface text-stone flex h-6 w-6 items-center justify-center rounded-xs border border-line font-mono text-xs">
                          {index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-ink">{previewTitle}</span>
                            <Badge tone="neutral">{section.blockType.replace(/_/g, ' ')}</Badge>
                            {!section.isVisible && <Badge tone="warning">Hidden</Badge>}
                          </div>
                          {subtitle && (
                            <p className="text-stone mt-0.5 line-clamp-1 text-xs">{subtitle}</p>
                          )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          className="text-stone h-7 w-7 p-0 hover:text-ink disabled:opacity-20"
                          title="Move Up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={index === page.sections.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          className="text-stone h-7 w-7 p-0 hover:text-ink disabled:opacity-20"
                          title="Move Down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleVisibility(section)}
                          className="text-stone h-7 w-7 p-0 hover:text-ink"
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
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-stone h-7 w-7 p-0 hover:text-ink"
                              title="Edit Section"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          }
                          onSuccess={() => router.refresh()}
                        />

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSection(section)}
                          className="text-stone h-7 w-7 p-0 hover:text-oxblood"
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

        {/* Right Col: Page Settings & SEO */}
        <div className="space-y-4">
          <div className="bg-canvas space-y-4 rounded-sm border border-line p-5">
            <h2 className="text-sm font-semibold text-ink">Page Configuration</h2>

            <form onSubmit={handleSavePageSettings} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="title" className="text-stone text-xs">
                  Title
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-surface h-9 border-line text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="slug" className="text-stone text-xs">
                  Slug
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="bg-surface h-9 border-line font-mono text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="status" className="text-stone text-xs">
                  Status
                </Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PageStatus)}
                  className="bg-surface h-9 w-full rounded-sm border border-line px-3 text-xs text-ink focus:ring-1 focus:ring-gold focus:outline-hidden"
                >
                  <option value="draft">Draft (Private)</option>
                  <option value="published">Published (Live to public)</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="desc" className="text-stone text-xs">
                  Description
                </Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-surface min-h-[60px] border-line text-xs"
                />
              </div>

              <div className="space-y-3 border-t border-line pt-2">
                <span className="block text-xs font-semibold text-ink">SEO Metadata</span>
                <div className="space-y-1">
                  <Label htmlFor="seoTitle" className="text-stone text-xs">
                    Meta Title
                  </Label>
                  <Input
                    id="seoTitle"
                    placeholder="Page Title | AUREN"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    className="bg-surface h-9 border-line text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="seoDesc" className="text-stone text-xs">
                    Meta Description
                  </Label>
                  <Textarea
                    id="seoDesc"
                    placeholder="Search snippet text..."
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    className="bg-surface min-h-[60px] border-line text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ogImage" className="text-stone text-xs">
                    OG Image URL
                  </Label>
                  <Input
                    id="ogImage"
                    placeholder="https://..."
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    className="bg-surface h-9 border-line font-mono text-xs"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={isSavingPage}
                className="text-canvas mt-2 w-full gap-1.5 bg-ink text-xs hover:bg-ink/90"
              >
                <Save className="h-3.5 w-3.5" />
                {isSavingPage ? 'Saving Settings...' : 'Save Page Settings'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
