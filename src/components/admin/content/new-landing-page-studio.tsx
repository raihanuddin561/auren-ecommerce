'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createPageFromTemplateAction } from '@/modules/content/actions';
import { LANDING_PAGE_TEMPLATES, type LandingPageTemplate } from '@/modules/content/templates';
import type { PageStatus } from '@/modules/content/types';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Layers,
  Scissors,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

const ICON_MAP = {
  Sparkles,
  Scissors,
  ShieldCheck,
  Layers,
};

export function NewLandingPageStudio() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<LandingPageTemplate>(
    LANDING_PAGE_TEMPLATES[0]!,
  );
  const [title, setTitle] = useState(LANDING_PAGE_TEMPLATES[0]!.title);
  const [slug, setSlug] = useState('autumn-winter-2026-capsule');
  const [description, setDescription] = useState(LANDING_PAGE_TEMPLATES[0]!.description);
  const [status, setStatus] = useState<PageStatus>('draft');
  const [isCreating, setIsCreating] = useState(false);

  const handleSelectTemplate = (tmpl: LandingPageTemplate) => {
    setSelectedTemplate(tmpl);
    setTitle(tmpl.title);
    const autoSlug = tmpl.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(autoSlug);
    setDescription(tmpl.description);
    setStatus(tmpl.defaultStatus);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(autoSlug);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      toast.error('Title and URL slug are required');
      return;
    }

    setIsCreating(true);
    try {
      const res = await createPageFromTemplateAction({
        templateId: selectedTemplate.id,
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        status,
      });

      if (!res.ok) {
        toast.error(res.error.message ?? 'Failed to initialize landing page');
        return;
      }

      toast.success(`"${title}" initialized with ${selectedTemplate.sections.length} blocks!`);
      router.push(`/admin/content/${res.data.id}`);
    } catch {
      toast.error('Unexpected error launching studio');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col items-start justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-fg-muted hover:text-fg"
            >
              <Link href="/admin/content">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Landing Pages
              </Link>
            </Button>
            <span className="text-line">/</span>
            <span className="font-mono text-xs text-gold">Landing Page Studio</span>
          </div>
          <h1 className="font-serif text-2xl font-light tracking-tight text-fg md:text-3xl">
            Create Luxury Landing Page
          </h1>
          <p className="text-xs text-fg-muted">
            Select an atelier starter template or build from an empty canvas. Every template
            generates high-fidelity blocks ready for customization.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-8">
        {/* Step 1: Template Selection Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/15 font-mono text-xs font-semibold text-accent-text">
                1
              </span>
              <h2 className="text-sm font-semibold text-fg">Choose a Starter Architecture</h2>
            </div>
            <span className="text-xs text-fg-muted">
              {LANDING_PAGE_TEMPLATES.length} Curated Templates
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {LANDING_PAGE_TEMPLATES.map((tmpl) => {
              const isSelected = selectedTemplate.id === tmpl.id;
              const Icon = ICON_MAP[tmpl.icon as keyof typeof ICON_MAP] ?? Sparkles;

              return (
                <div
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-sm border p-5 transition-all ${
                    isSelected
                      ? 'shadow-xs border-gold bg-raised ring-1 ring-gold'
                      : 'hover:border-line-hover border-line bg-page hover:bg-raised/50'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div
                        className={`inline-flex rounded-xs p-2.5 transition-colors ${
                          isSelected
                            ? 'bg-gold/15 text-accent-text'
                            : 'bg-raised text-fg-muted group-hover:text-fg'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge tone={isSelected ? 'gold' : 'neutral'} className="text-xs">
                        {tmpl.badge}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-serif text-base font-medium text-fg">{tmpl.title}</h3>
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-fg-muted">
                        {tmpl.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-line/60 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-xs text-fg-muted">
                        <strong className="text-fg">{tmpl.sections.length}</strong>{' '}
                        {tmpl.sections.length === 1 ? 'section block' : 'section blocks'}
                      </span>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 font-medium text-accent-text">
                          <Check className="h-3.5 w-3.5" /> Selected
                        </span>
                      ) : (
                        <span className="text-fg-subtle group-hover:text-fg-muted">Choose</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Configuration & Preview Split */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Form Settings */}
          <div className="space-y-5 rounded-sm border border-line bg-raised p-6 lg:col-span-2">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/15 font-mono text-xs font-semibold text-accent-text">
                2
              </span>
              <h2 className="text-sm font-semibold text-fg">Page Identity & URL Route</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pageTitle" className="text-xs text-fg-muted">
                  Page Title *
                </Label>
                <Input
                  id="pageTitle"
                  placeholder="e.g. Summer Solstice 2026 Drop"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="h-10 border-line bg-page text-sm font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pageSlug" className="text-xs text-fg-muted">
                  Storefront URL Route *
                </Label>
                <div className="flex items-center rounded-sm border border-line bg-page px-3 font-mono text-xs text-fg-muted focus-within:border-gold">
                  <span className="text-fg-subtle select-none">https://aurenbd.shop/pages/</span>
                  <Input
                    id="pageSlug"
                    placeholder="autumn-winter-2026-capsule"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="h-9 border-0 bg-transparent px-1 font-mono text-xs text-fg shadow-none focus-visible:ring-0"
                    required
                  />
                </div>
                <p className="text-xs text-fg-subtle">
                  Unique path customers will visit. Automatically URL-sanitized.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pageDescription" className="text-xs text-fg-muted">
                  Editorial Excerpt / Subtitle
                </Label>
                <Textarea
                  id="pageDescription"
                  placeholder="Summary of this campaign or story..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[85px] border-line bg-page text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pageStatus" className="text-xs text-fg-muted">
                  Initial Publication Status
                </Label>
                <select
                  id="pageStatus"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PageStatus)}
                  className="h-9 w-full rounded-sm border border-line bg-page px-3 text-xs text-fg focus:ring-1 focus:ring-gold focus:outline-hidden"
                >
                  <option value="draft">Draft — Private to atelier staff only</option>
                  <option value="published">Published — Immediately live on storefront</option>
                  <option value="scheduled">Scheduled — Set for future activation</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Column: Pre-configured Block Preview */}
          <div className="space-y-5 rounded-sm border border-line bg-raised p-6">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-semibold text-fg">Included Blocks</h2>
              </div>
              <Badge tone="gold" className="text-xs">
                {selectedTemplate.sections.length} Blocks
              </Badge>
            </div>

            <p className="text-xs leading-relaxed text-fg-muted">
              When created, the page studio will instantiate these pre-styled blocks which you can
              further reorder, edit, or customize with live visual preview:
            </p>

            <div className="space-y-2">
              {selectedTemplate.sections.map((sec, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xs border border-line/60 bg-page/70 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-xs bg-raised font-mono text-xs text-fg-muted">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-fg">{sec.name}</span>
                  </div>
                  <Badge tone="neutral" className="text-xs">
                    {sec.blockType.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="border-t border-line pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={isCreating}
                className="w-full gap-2 bg-ink text-xs font-medium text-ivory hover:bg-ink/90"
              >
                {isCreating ? (
                  <>
                    <Zap className="h-3.5 w-3.5 animate-spin" /> Initializing Studio...
                  </>
                ) : (
                  <>
                    Launch Studio & Customize <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
              <p className="mt-2 text-center text-xs text-fg-subtle">
                Redirects to the full drag-and-drop block builder and live preview.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
