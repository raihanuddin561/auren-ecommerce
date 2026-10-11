'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type {
  BrandPerksProps,
  CategoryGridProps,
  EditorialQuoteProps,
  FaqAccordionProps,
  FeaturedCollectionProps,
  HeroBannerProps,
  LookbookStripProps,
  NewsletterStripProps,
  PageSectionItem,
  RichTextProps,
  SplitBannerProps,
  VideoSpotlightProps,
} from '@/modules/content/types';
import {
  Sparkles,
  ShieldCheck,
  Truck,
  Scissors,
  Clock,
  ChevronDown,
  ArrowRight,
  Heart,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';

const ICON_MAP: Record<string, typeof Sparkles> = {
  Sparkles,
  ShieldCheck,
  Truck,
  Scissors,
  Clock,
  Heart,
  Award,
};

interface SectionRendererProps {
  sections: PageSectionItem[];
}

export function SectionRenderer({ sections }: SectionRendererProps) {
  if (!sections || sections.length === 0) {
    return (
      <div className="py-24 text-center text-fg-muted">
        <p className="type-body-sm">This page has no active sections configured yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-16 md:space-y-24">
      {sections.map((section) => (
        <section key={section.id} id={`section-${section.id}`} className="relative">
          <RenderBlock blockType={section.blockType} props={section.props} />
        </section>
      ))}
    </div>
  );
}

function RenderBlock({
  blockType,
  props,
}: {
  blockType: PageSectionItem['blockType'];
  props: Record<string, unknown>;
}) {
  switch (blockType) {
    case 'hero_banner':
      return <HeroBannerSection props={props as unknown as HeroBannerProps} />;
    case 'editorial_quote':
      return <EditorialQuoteSection props={props as unknown as EditorialQuoteProps} />;
    case 'brand_perks':
      return <BrandPerksSection props={props as unknown as BrandPerksProps} />;
    case 'newsletter_strip':
      return <NewsletterStripSection props={props as unknown as NewsletterStripProps} />;
    case 'rich_text':
      return <RichTextSection props={props as unknown as RichTextProps} />;
    case 'faq_accordion':
      return <FaqAccordionSection props={props as unknown as FaqAccordionProps} />;
    case 'split_banner':
      return <SplitBannerSection props={props as unknown as SplitBannerProps} />;
    case 'lookbook_strip':
      return <LookbookStripSection props={props as unknown as LookbookStripProps} />;
    case 'video_spotlight':
      return <VideoSpotlightSection props={props as unknown as VideoSpotlightProps} />;
    case 'featured_collection':
      return <FeaturedCollectionSection props={props as unknown as FeaturedCollectionProps} />;
    case 'category_grid':
      return <CategoryGridSection props={props as unknown as CategoryGridProps} />;
    default:
      return null;
  }
}

// =============================================================================================
// Block: Hero Banner
// =============================================================================================

function HeroBannerSection({ props }: { props: HeroBannerProps }) {
  const isInk = props.theme !== 'ivory';

  return (
    <div
      className={`relative flex min-h-[60vh] items-center justify-center overflow-hidden px-6 py-20 md:min-h-[75vh] ${
        isInk ? 'bg-ink text-ivory' : 'bg-page text-fg'
      }`}
    >
      {props.mediaUrl && (
        <div className="absolute inset-0 z-0">
          <Image
            src={props.mediaUrl}
            alt={props.headline}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div
            className={`absolute inset-0 ${isInk ? 'bg-ink' : 'bg-page'}`}
            style={{ opacity: (props.overlayOpacity ?? 30) / 100 }}
          />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-4xl space-y-6 text-center">
        <Badge tone="gold" className="px-3 py-1 tracking-widest uppercase">
          Auren Atelier
        </Badge>
        <h1 className="font-serif text-3xl leading-tight font-light tracking-tight md:text-5xl lg:text-6xl">
          {props.headline}
        </h1>
        {props.subtitle && (
          <p
            className={`mx-auto max-w-2xl text-sm leading-relaxed font-light md:text-base ${
              isInk ? 'text-ivory/80' : 'text-fg-muted'
            }`}
          >
            {props.subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          {props.ctaLabel && props.ctaUrl && (
            <Button asChild size="lg" className="bg-gold font-medium text-ink hover:bg-gold/90">
              <Link href={props.ctaUrl}>{props.ctaLabel}</Link>
            </Button>
          )}
          {props.secondaryCtaLabel && props.secondaryCtaUrl && (
            <Button
              asChild
              variant="secondary"
              size="lg"
              className={isInk ? 'border-line text-ivory hover:bg-ivory/10' : ''}
            >
              <Link href={props.secondaryCtaUrl}>{props.secondaryCtaLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================================
// Block: Editorial Quote
// =============================================================================================

function EditorialQuoteSection({ props }: { props: EditorialQuoteProps }) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-center">
      <span className="block font-serif text-4xl leading-none text-accent-text select-none md:text-6xl">
        &ldquo;
      </span>
      <blockquote className="mt-2 font-serif text-xl leading-relaxed font-light text-fg italic md:text-3xl">
        {props.quote}
      </blockquote>
      <div className="mt-6 space-y-1">
        {props.author && (
          <p className="text-xs font-semibold tracking-widest text-fg uppercase">{props.author}</p>
        )}
        {props.title && <p className="text-xs tracking-wide text-fg-muted">{props.title}</p>}
      </div>
    </div>
  );
}

// =============================================================================================
// Block: Brand Perks
// =============================================================================================

function BrandPerksSection({ props }: { props: BrandPerksProps }) {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {(props.headline || props.subtitle) && (
        <div className="mx-auto mb-12 max-w-2xl space-y-2 text-center">
          {props.headline && (
            <h2 className="font-serif text-2xl font-medium text-fg md:text-3xl">
              {props.headline}
            </h2>
          )}
          {props.subtitle && <p className="text-xs text-fg-muted md:text-sm">{props.subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {props.items.map((item, index) => {
          const Icon = ICON_MAP[item.icon] ?? Sparkles;
          return (
            <div
              key={index}
              className="space-y-4 rounded-sm border border-line bg-raised/40 p-8 text-center transition-colors hover:border-gold/40"
            >
              <div className="inline-flex rounded-xs bg-gold/10 p-3 text-accent-text">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-base font-semibold text-fg">{item.title}</h3>
              <p className="text-xs leading-relaxed text-fg-muted">{item.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================================
// Block: Newsletter Strip
// =============================================================================================

function NewsletterStripSection({ props }: { props: NewsletterStripProps }) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSubscribed(true);
    toast.success('You have been invited to the Auren Inner Circle');
  };

  return (
    <div className="mx-auto max-w-4xl px-6">
      <div className="space-y-6 rounded-sm border border-line bg-page p-10 text-center md:p-14">
        <Badge tone="gold" className="px-2.5 py-0.5 tracking-widest uppercase">
          Private Invitation
        </Badge>
        <h2 className="font-serif text-2xl font-light tracking-tight text-fg md:text-3xl">
          {props.headline}
        </h2>
        {props.subtitle && (
          <p className="mx-auto max-w-xl text-xs leading-relaxed text-fg-muted md:text-sm">
            {props.subtitle}
          </p>
        )}
        {subscribed ? (
          <div className="rounded-xs bg-gold/10 p-4 text-xs font-medium text-accent-text">
            Thank you. Your atelier invitation has been registered.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <Input
              type="email"
              placeholder="Enter your private email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 border-line bg-raised text-xs text-fg"
              required
            />
            <Button
              type="submit"
              size="sm"
              className="h-10 bg-ink px-6 whitespace-nowrap text-ivory hover:bg-ink/90"
            >
              {props.buttonLabel ?? 'Request Access'}
            </Button>
          </form>
        )}
        {props.disclaimer && (
          <p className="text-xs tracking-wider text-fg-subtle uppercase">{props.disclaimer}</p>
        )}
      </div>
    </div>
  );
}

// =============================================================================================
// Block: Rich Text
// =============================================================================================

function RichTextSection({ props }: { props: RichTextProps }) {
  const isCentered = props.alignment === 'center';

  return (
    <div className="mx-auto max-w-3xl px-6">
      {(props.headline || props.subtitle) && (
        <div className={`mb-8 space-y-2 ${isCentered ? 'text-center' : 'text-left'}`}>
          {props.headline && (
            <h2 className="font-serif text-2xl font-medium text-fg md:text-3xl">
              {props.headline}
            </h2>
          )}
          {props.subtitle && <p className="text-xs text-fg-muted md:text-sm">{props.subtitle}</p>}
        </div>
      )}
      <div
        className={`prose prose-stone space-y-4 text-xs leading-relaxed text-fg md:text-sm ${
          isCentered ? 'mx-auto text-center' : 'text-left'
        }`}
      >
        {props.content.split('\n\n').map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

// =============================================================================================
// Block: FAQ Accordion
// =============================================================================================

function FaqAccordionSection({ props }: { props: FaqAccordionProps }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="mx-auto max-w-3xl px-6">
      {(props.headline || props.subtitle) && (
        <div className="mb-10 space-y-2 text-center">
          {props.headline && (
            <h2 className="font-serif text-2xl font-medium text-fg md:text-3xl">
              {props.headline}
            </h2>
          )}
          {props.subtitle && <p className="text-xs text-fg-muted md:text-sm">{props.subtitle}</p>}
        </div>
      )}
      <div className="divide-y divide-line border-y border-line">
        {props.items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="py-4">
              <button
                type="button"
                onClick={() => toggle(index)}
                className="flex w-full items-center justify-between py-1 text-left font-serif text-sm font-medium text-fg transition-colors hover:text-accent-text"
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`h-4 w-4 text-fg-muted transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-accent-text' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="mt-3 pr-6 text-xs leading-relaxed text-fg-muted">{item.answer}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================================
// Block: Split Banner
// =============================================================================================

function SplitBannerSection({ props }: { props: SplitBannerProps }) {
  const isMediaRight = props.mediaPosition === 'right';

  return (
    <div className="mx-auto max-w-6xl px-6">
      <div
        className={`grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14 ${
          isMediaRight ? 'md:grid-flow-dense' : ''
        }`}
      >
        <div
          className={`relative aspect-[4/3] overflow-hidden rounded-sm border border-line bg-raised md:aspect-[4/5] ${isMediaRight ? 'md:col-start-2' : ''}`}
        >
          <Image
            src={props.mediaUrl}
            alt={props.headline}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        <div className={`space-y-5 ${isMediaRight ? 'md:col-start-1' : ''}`}>
          {props.eyebrow && (
            <Badge tone="gold" className="px-2.5 py-0.5 tracking-widest uppercase">
              {props.eyebrow}
            </Badge>
          )}
          <h2 className="font-serif text-2xl leading-tight font-light tracking-tight text-fg md:text-4xl">
            {props.headline}
          </h2>
          <p className="text-xs leading-relaxed text-fg-muted md:text-sm">{props.description}</p>
          {props.ctaLabel && props.ctaUrl && (
            <div className="pt-2">
              <Button asChild size="sm" className="gap-2 bg-ink text-ivory hover:bg-ink/90">
                <Link href={props.ctaUrl}>
                  {props.ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================================
// Block: Lookbook Strip
// =============================================================================================

function LookbookStripSection({ props }: { props: LookbookStripProps }) {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {(props.headline || props.subtitle) && (
        <div className="mx-auto mb-10 max-w-2xl space-y-2 text-center">
          {props.headline && (
            <h2 className="font-serif text-2xl font-medium text-fg md:text-3xl">
              {props.headline}
            </h2>
          )}
          {props.subtitle && <p className="text-xs text-fg-muted md:text-sm">{props.subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8">
        <div className="group relative aspect-[4/5] overflow-hidden rounded-sm border border-line bg-raised">
          <Image
            src={props.image1Url}
            alt="Lookbook editorial frame 1"
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        <div className="group relative aspect-[4/5] overflow-hidden rounded-sm border border-line bg-raised">
          <Image
            src={props.image2Url}
            alt="Lookbook editorial frame 2"
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </div>
      {props.ctaLabel && props.ctaUrl && (
        <div className="mt-8 text-center">
          <Button asChild variant="secondary" size="sm" className="gap-2">
            <Link href={props.ctaUrl}>
              {props.ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================================
// Block: Video Spotlight
// =============================================================================================

function VideoSpotlightSection({ props }: { props: VideoSpotlightProps }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 text-center">
      {(props.headline || props.subtitle) && (
        <div className="space-y-2">
          {props.headline && (
            <h2 className="font-serif text-2xl font-medium text-fg md:text-3xl">
              {props.headline}
            </h2>
          )}
          {props.subtitle && <p className="text-xs text-fg-muted md:text-sm">{props.subtitle}</p>}
        </div>
      )}
      <div className="relative aspect-video overflow-hidden rounded-sm border border-line bg-raised">
        <video
          src={props.videoUrl}
          poster={props.posterUrl}
          controls
          className="h-full w-full object-cover"
        />
      </div>
      {props.ctaLabel && props.ctaUrl && (
        <div>
          <Button asChild size="sm" className="bg-ink text-ivory hover:bg-ink/90">
            <Link href={props.ctaUrl}>{props.ctaLabel}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================================
// Block: Category Grid
// =============================================================================================

function CategoryGridSection({ props }: { props: CategoryGridProps }) {
  const cols = props.columns || 3;
  const colClass =
    cols === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : cols === 4
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';

  return (
    <div className="mx-auto max-w-6xl px-6">
      {(props.headline || props.subtitle) && (
        <div className="mx-auto mb-10 max-w-2xl space-y-2 text-center">
          {props.headline && (
            <h2 className="font-serif text-2xl font-light tracking-tight text-fg md:text-3xl">
              {props.headline}
            </h2>
          )}
          {props.subtitle && (
            <p className="text-xs font-light text-fg-muted md:text-sm">{props.subtitle}</p>
          )}
        </div>
      )}
      <div className={`grid gap-6 md:gap-8 ${colClass}`}>
        {(props.items ?? []).map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className="group relative block aspect-[3/4] overflow-hidden rounded-sm border border-line bg-raised"
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-raised to-ink/90" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent transition-opacity group-hover:from-ink/95" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-ivory">
              {item.subtitle && (
                <p className="font-mono text-xs tracking-widest text-gold uppercase">
                  {item.subtitle}
                </p>
              )}
              <h3 className="mt-1 font-serif text-lg font-medium text-ivory transition-colors group-hover:text-gold md:text-xl">
                {item.title}
              </h3>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-ivory/80 transition-colors group-hover:text-gold">
                <span>Explore</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// =============================================================================================
// Block: Featured Collection
// =============================================================================================

function FeaturedCollectionSection({ props }: { props: FeaturedCollectionProps }) {
  const showcaseItems = [
    {
      title: 'Bespoke Double-Breasted Suit',
      fabric: 'Super 150s Tasmanian Wool',
      price: '৳38,500',
      image:
        'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'Pure Cashmere Overcoat',
      fabric: 'Mongolian Grade-A Cashmere',
      price: '৳45,000',
      image:
        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'Heritage Artisanal Panjabi',
      fabric: 'Hand-woven Noble Cotton',
      price: '৳14,500',
      image:
        'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'Spread Collar Poplin Shirt',
      fabric: 'Giza 87 Egyptian Cotton',
      price: '৳8,500',
      image:
        'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="flex flex-col items-center justify-between gap-4 border-b border-line pb-6 text-center sm:flex-row sm:text-left">
        <div>
          <Badge tone="gold" className="mb-2 px-2.5 py-0.5 tracking-widest uppercase">
            Curated Collection
          </Badge>
          <h2 className="font-serif text-2xl font-light tracking-tight text-fg md:text-3xl">
            {props.headline || 'Featured Pieces'}
          </h2>
          {props.subtitle && (
            <p className="mt-1 text-xs font-light text-fg-muted md:text-sm">{props.subtitle}</p>
          )}
        </div>
        <Button asChild variant="secondary" size="sm" className="gap-2 text-xs">
          <Link href={`/collections/${props.collectionSlug}`}>
            {props.viewAllLabel || 'Explore All Pieces'} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {showcaseItems.slice(0, props.limit || 4).map((item, idx) => (
          <Link
            key={idx}
            href={`/collections/${props.collectionSlug}`}
            className="group flex flex-col overflow-hidden rounded-sm border border-line bg-raised transition-all hover:border-gold/50"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-raised">
              <Image
                src={item.image}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, 25vw"
              />
            </div>
            <div className="flex flex-1 flex-col p-3.5 sm:p-4">
              <p className="text-xs tracking-wider text-fg-muted uppercase">{item.fabric}</p>
              <h4 className="mt-1 font-serif text-xs font-medium text-fg transition-colors group-hover:text-gold sm:text-sm">
                {item.title}
              </h4>
              <div className="mt-auto pt-3">
                <span className="font-mono text-xs font-semibold text-fg">{item.price}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
