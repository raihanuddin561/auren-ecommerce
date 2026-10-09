'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createPageSectionAction, updatePageSectionAction } from '@/modules/content/actions';
import type { BlockType, PageSectionItem } from '@/modules/content/types';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface SectionEditorDialogProps {
  pageId: string;
  section?: PageSectionItem;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const BLOCK_OPTIONS: { type: BlockType; label: string; desc: string }[] = [
  {
    type: 'hero_banner',
    label: 'Hero Banner',
    desc: 'Prominent headline, CTA buttons, background image',
  },
  {
    type: 'editorial_quote',
    label: 'Editorial Quote',
    desc: 'Serif brand quotation, atelier philosophy',
  },
  {
    type: 'brand_perks',
    label: 'Brand Commitments / Perks',
    desc: '3 pillars of craft, delivery, noble fibers',
  },
  {
    type: 'newsletter_strip',
    label: 'Newsletter Invitation',
    desc: 'Private atelier circle signup strip',
  },
  {
    type: 'rich_text',
    label: 'Rich Text / Story',
    desc: 'Formatted paragraphs, stories, craftsman notes',
  },
  {
    type: 'split_banner',
    label: 'Split 50/50 Banner',
    desc: 'Image beside story headline and CTA',
  },
  { type: 'lookbook_strip', label: 'Lookbook Two-Up Strip', desc: 'Dual editorial 4:5 portraits' },
  { type: 'faq_accordion', label: 'FAQ Accordions', desc: 'Question and answer expandable items' },
  { type: 'video_spotlight', label: 'Video Spotlight', desc: 'Atelier craftsmanship video player' },
];

export function SectionEditorDialog({
  pageId,
  section,
  trigger,
  onSuccess,
}: SectionEditorDialogProps) {
  const isEditing = Boolean(section);
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [blockType, setBlockType] = useState<BlockType>(section?.blockType ?? 'hero_banner');
  const [name, setName] = useState(section?.name ?? '');

  // Block props states
  const p = (section?.props ?? {}) as Record<string, unknown>;
  const [headline, setHeadline] = useState(typeof p.headline === 'string' ? p.headline : '');
  const [subtitle, setSubtitle] = useState(typeof p.subtitle === 'string' ? p.subtitle : '');
  const [ctaLabel, setCtaLabel] = useState(typeof p.ctaLabel === 'string' ? p.ctaLabel : '');
  const [ctaUrl, setCtaUrl] = useState(typeof p.ctaUrl === 'string' ? p.ctaUrl : '');
  const [mediaUrl, setMediaUrl] = useState(typeof p.mediaUrl === 'string' ? p.mediaUrl : '');
  const [quote, setQuote] = useState(typeof p.quote === 'string' ? p.quote : '');
  const [author, setAuthor] = useState(typeof p.author === 'string' ? p.author : '');
  const [content, setContent] = useState(typeof p.content === 'string' ? p.content : '');
  const [description, setDescription] = useState(
    typeof p.description === 'string' ? p.description : '',
  );
  const [image1Url, setImage1Url] = useState(typeof p.image1Url === 'string' ? p.image1Url : '');
  const [image2Url, setImage2Url] = useState(typeof p.image2Url === 'string' ? p.image2Url : '');
  const [videoUrl, setVideoUrl] = useState(typeof p.videoUrl === 'string' ? p.videoUrl : '');

  const buildProps = (): Record<string, unknown> => {
    switch (blockType) {
      case 'hero_banner':
        return {
          headline: headline.trim() || 'Atelier Signature',
          subtitle: subtitle.trim() || undefined,
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          mediaUrl: mediaUrl.trim() || undefined,
          theme: 'ink',
          overlayOpacity: 35,
        };
      case 'editorial_quote':
        return {
          quote: quote.trim() || 'Crafted with intention.',
          author: author.trim() || 'Auren Atelier',
        };
      case 'brand_perks':
        return {
          headline: headline.trim() || 'The Atelier Commitments',
          subtitle: subtitle.trim() || undefined,
          items: p.items ?? [
            {
              icon: 'Sparkles',
              title: 'Noble Fibers',
              description: 'Giza cotton and Italian wool.',
            },
            {
              icon: 'Scissors',
              title: 'Master Tailored',
              description: 'Reinforced pick-stitching.',
            },
            {
              icon: 'Truck',
              title: 'White-Glove Delivery',
              description: 'Banani studio dispatch.',
            },
          ],
        };
      case 'newsletter_strip':
        return {
          headline: headline.trim() || 'Join The Atelier Circle',
          subtitle: subtitle.trim() || undefined,
          buttonLabel: ctaLabel.trim() || 'Request Access',
        };
      case 'rich_text':
        return {
          headline: headline.trim() || undefined,
          subtitle: subtitle.trim() || undefined,
          content: content.trim() || 'Our atelier values slow elegance and artisanal care.',
          alignment: 'center',
        };
      case 'split_banner':
        return {
          mediaUrl:
            mediaUrl.trim() ||
            'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200',
          headline: headline.trim() || 'A Modern Perspective on Bespoke',
          description: description.trim() || 'Constructed with precision in Dhaka.',
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          mediaPosition: 'left',
        };
      case 'lookbook_strip':
        return {
          headline: headline.trim() || 'The Seasonal Lookbook',
          subtitle: subtitle.trim() || undefined,
          image1Url:
            image1Url.trim() ||
            'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200',
          image2Url:
            image2Url.trim() ||
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200',
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
        };
      case 'faq_accordion':
        return {
          headline: headline.trim() || 'Frequently Asked Questions',
          subtitle: subtitle.trim() || undefined,
          items: p.items ?? [
            {
              question: 'What is the turnaround for bespoke commissions?',
              answer: 'Commissions take 7 to 10 working days.',
            },
            {
              question: 'Where are garments constructed?',
              answer: 'In our dedicated atelier workshop in Banani, Dhaka.',
            },
          ],
        };
      case 'video_spotlight':
        return {
          videoUrl: videoUrl.trim() || 'https://www.w3schools.com/html/mov_bbb.mp4',
          headline: headline.trim() || undefined,
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
        };
      default:
        return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const props = buildProps();

      if (isEditing && section) {
        const res = await updatePageSectionAction({
          id: section.id,
          name: name.trim() || undefined,
          props,
        });

        if (!res.ok) {
          toast.error(res.error.message ?? 'Failed to update section');
          return;
        }

        toast.success('Section updated');
      } else {
        const res = await createPageSectionAction({
          pageId,
          blockType,
          name: name.trim() || undefined,
          props,
        });

        if (!res.ok) {
          toast.error(res.error.message ?? 'Failed to add section');
          return;
        }

        toast.success('Section block added');
      }

      setOpen(false);
      onSuccess?.();
    } catch {
      toast.error('Unexpected error saving section');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button size="sm" className="text-canvas gap-1.5 bg-ink text-xs hover:bg-ink/90">
            <Plus className="h-3.5 w-3.5" />
            Add Section Block
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-canvas max-h-[90vh] max-w-lg overflow-y-auto border-line">
        <DialogHeader>
          <DialogTitle className="font-serif text-base font-semibold text-ink">
            {isEditing ? 'Edit Section Block' : 'Add Section Block'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="blockType" className="text-stone text-xs">
                Block Type *
              </Label>
              <select
                id="blockType"
                value={blockType}
                onChange={(e) => setBlockType(e.target.value as BlockType)}
                className="bg-surface h-9 w-full rounded-sm border border-line px-3 text-xs text-ink focus:ring-1 focus:ring-gold focus:outline-hidden"
              >
                {BLOCK_OPTIONS.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.label} — {opt.desc}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="blockName" className="text-stone text-xs">
              Admin Label (Optional identifier)
            </Label>
            <Input
              id="blockName"
              placeholder="e.g. Master Hero Banner"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface h-9 border-line text-xs"
            />
          </div>

          {/* Conditional Prop Fields based on Block Type */}
          {(blockType === 'hero_banner' ||
            blockType === 'brand_perks' ||
            blockType === 'newsletter_strip' ||
            blockType === 'rich_text' ||
            blockType === 'split_banner' ||
            blockType === 'lookbook_strip' ||
            blockType === 'faq_accordion' ||
            blockType === 'video_spotlight') && (
            <div className="space-y-1.5">
              <Label htmlFor="headline" className="text-stone text-xs">
                Headline
              </Label>
              <Input
                id="headline"
                placeholder="Section title or headline..."
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="bg-surface h-9 border-line text-xs"
              />
            </div>
          )}

          {(blockType === 'hero_banner' ||
            blockType === 'brand_perks' ||
            blockType === 'newsletter_strip' ||
            blockType === 'rich_text' ||
            blockType === 'lookbook_strip' ||
            blockType === 'faq_accordion' ||
            blockType === 'video_spotlight') && (
            <div className="space-y-1.5">
              <Label htmlFor="subtitle" className="text-stone text-xs">
                Subtitle / Description
              </Label>
              <Input
                id="subtitle"
                placeholder="Secondary descriptive copy..."
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="bg-surface h-9 border-line text-xs"
              />
            </div>
          )}

          {blockType === 'editorial_quote' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="quote" className="text-stone text-xs">
                  Quote Text *
                </Label>
                <Textarea
                  id="quote"
                  placeholder="Enter the quote text..."
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  className="bg-surface min-h-[90px] border-line text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="author" className="text-stone text-xs">
                  Author / Atelier Citation
                </Label>
                <Input
                  id="author"
                  placeholder="e.g. Master Tailor"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="bg-surface h-9 border-line text-xs"
                />
              </div>
            </>
          )}

          {blockType === 'rich_text' && (
            <div className="space-y-1.5">
              <Label htmlFor="content" className="text-stone text-xs">
                Body Content (Paragraphs) *
              </Label>
              <Textarea
                id="content"
                placeholder="Enter story paragraphs..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="bg-surface min-h-[120px] border-line text-xs"
                required
              />
            </div>
          )}

          {blockType === 'split_banner' && (
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-stone text-xs">
                Description *
              </Label>
              <Textarea
                id="description"
                placeholder="Detailed story copy..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-surface min-h-[90px] border-line text-xs"
                required
              />
            </div>
          )}

          {(blockType === 'hero_banner' || blockType === 'split_banner') && (
            <div className="space-y-1.5">
              <Label htmlFor="mediaUrl" className="text-stone text-xs">
                Media / Image URL
              </Label>
              <Input
                id="mediaUrl"
                placeholder="https://images.unsplash.com/..."
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="bg-surface h-9 border-line font-mono text-xs"
              />
            </div>
          )}

          {blockType === 'lookbook_strip' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="image1" className="text-stone text-xs">
                  Lookbook Image 1 URL *
                </Label>
                <Input
                  id="image1"
                  placeholder="https://..."
                  value={image1Url}
                  onChange={(e) => setImage1Url(e.target.value)}
                  className="bg-surface h-9 border-line font-mono text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="image2" className="text-stone text-xs">
                  Lookbook Image 2 URL *
                </Label>
                <Input
                  id="image2"
                  placeholder="https://..."
                  value={image2Url}
                  onChange={(e) => setImage2Url(e.target.value)}
                  className="bg-surface h-9 border-line font-mono text-xs"
                  required
                />
              </div>
            </div>
          )}

          {blockType === 'video_spotlight' && (
            <div className="space-y-1.5">
              <Label htmlFor="videoUrl" className="text-stone text-xs">
                Video Stream URL (MP4 / WebM) *
              </Label>
              <Input
                id="videoUrl"
                placeholder="https://.../video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="bg-surface h-9 border-line font-mono text-xs"
                required
              />
            </div>
          )}

          {(blockType === 'hero_banner' ||
            blockType === 'split_banner' ||
            blockType === 'lookbook_strip' ||
            blockType === 'video_spotlight') && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ctaLabel" className="text-stone text-xs">
                  CTA Button Label
                </Label>
                <Input
                  id="ctaLabel"
                  placeholder="e.g. Explore Pieces"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className="bg-surface h-9 border-line text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctaUrl" className="text-stone text-xs">
                  CTA Destination URL
                </Label>
                <Input
                  id="ctaUrl"
                  placeholder="e.g. /shop"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  className="bg-surface h-9 border-line text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              className="border-line text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-canvas bg-ink text-xs hover:bg-ink/90"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Block' : 'Add Block'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
