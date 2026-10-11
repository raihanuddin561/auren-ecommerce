'use client';

import { CreditCard, Repeat, Star, Truck } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Icon } from '@/components/ui/icon';
import type { PdpData } from '@/modules/catalog/pdp';
import type { ProductRatingStatsData } from '@/modules/reviews/types';
import { useTranslation } from '@/lib/i18n/context';
import {
  translateProductTitle,
  translateCategory,
  translateDetailLabel,
  translateDetailValue,
  translateCatalogPhrase,
  toBengaliDigits,
} from '@/lib/i18n/catalog-translator';

/** Eyebrow, serif title, subtitle and social proof rating stars. The page's only h1. */
export function ProductHeading({
  product,
  stats,
}: {
  product: PdpData;
  stats?: ProductRatingStatsData | null;
}) {
  const { locale, isBn } = useTranslation();

  return (
    <header className="flex flex-col gap-3">
      {product.eyebrow ? (
        <p className="type-eyebrow text-fg-muted">{translateCategory(product.eyebrow, locale)}</p>
      ) : null}
      <h1 className="type-h1 text-fg">{translateProductTitle(product.title, locale)}</h1>
      {stats && stats.reviewCount > 0 ? (
        <a
          href="#reviews"
          className="inline-flex flex-wrap items-center gap-2 type-caption text-fg-muted transition-colors hover:text-accent-text"
        >
          <div className="flex items-center gap-0.5 text-accent-text">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={13}
                className={
                  i < Math.round(stats.averageRating)
                    ? 'fill-gold text-accent-text'
                    : 'text-stone-300'
                }
              />
            ))}
          </div>
          <span className="font-medium text-fg">
            {isBn
              ? toBengaliDigits(stats.averageRating.toFixed(1))
              : stats.averageRating.toFixed(1)}
          </span>
          <span>
            (
            {isBn
              ? `${toBengaliDigits(stats.reviewCount)}টি মতামত`
              : `${stats.reviewCount} ${stats.reviewCount === 1 ? 'review' : 'reviews'}`}
            )
          </span>
          <span className="text-fg-muted/40">•</span>
          <span className="font-medium text-accent-text">
            {isBn
              ? `${toBengaliDigits(stats.fitTrueToSizePercentage)}% সঠিক সাইজ ফিট`
              : `${stats.fitTrueToSizePercentage}% True to size`}
          </span>
        </a>
      ) : null}
      {product.subtitle ? (
        <p className="type-body text-fg-muted">
          {isBn ? translateCatalogPhrase(product.subtitle) : product.subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function TrustRow() {
  const { isBn } = useTranslation();

  const trustItems = [
    {
      icon: Repeat,
      text: isBn ? 'হোম সাইজ এক্সচেঞ্জ সুবিধা' : 'Doorstep size exchange',
    },
    {
      icon: CreditCard,
      text: isBn ? 'ক্যাশ অন ডেলিভারি ও মোবাইল ব্যাংকিং' : 'COD & Mobile Banking',
    },
    {
      icon: Truck,
      text: isBn ? 'ঢাকা ২৪–৪৮ ঘণ্টা · সারাদেশে ২–৪ দিন' : '24–48h Dhaka · Nationwide 2–4d',
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-y border-line py-5">
      <ul className="grid gap-3 sm:grid-cols-3">
        {trustItems.map(({ icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 type-small text-fg">
            <Icon icon={icon} size={18} className="text-accent-text" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="type-eyebrow tracking-wider text-fg-muted uppercase">
          {isBn ? 'গৃহীত মাধ্যম:' : 'Accepted:'}
        </span>
        {['Cash on delivery', 'bKash', 'Nagad', 'Visa', 'Mastercard'].map((mark) => (
          <span
            key={mark}
            className="rounded-xs border border-line bg-sunken/80 px-2 py-0.5 type-caption font-medium text-fg-muted"
          >
            {mark}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Details and fit, fabric and care, delivery and returns. Plain text only, never HTML. */
export function ProductAccordions({ product }: { product: PdpData }) {
  const { locale, isBn } = useTranslation();

  return (
    <Accordion type="single" collapsible defaultValue="details" className="border-t border-line">
      <AccordionItem value="details">
        <AccordionTrigger>{isBn ? 'বিবরণ ও ফিট' : 'Details and fit'}</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3 type-body text-fg-muted">
            {product.description.map((paragraph, index) => (
              <p key={index}>{isBn ? translateCatalogPhrase(paragraph) : paragraph}</p>
            ))}
            {product.details.length > 0 ? (
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 type-small">
                {product.details.map((detail) => (
                  <div key={detail.label} className="contents">
                    <dt className="text-fg">{translateDetailLabel(detail.label, locale)}</dt>
                    <dd>{translateDetailValue(detail.value, locale)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="care">
        <AccordionTrigger>{isBn ? 'ফ্যাব্রিক ও যত্ন' : 'Fabric and care'}</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3 type-body text-fg-muted">
            {product.fabric ? (
              <p>
                {isBn
                  ? `তৈরি করা হয়েছে অভিজাত ${translateDetailValue(product.fabric, locale)} দিয়ে।`
                  : `Crafted in ${product.fabric.toLowerCase()}.`}
              </p>
            ) : null}
            <p>
              {isBn
                ? 'পোশাকে সংযুক্ত কেয়ার লেবেল অনুযায়ী যত্ন নিন।'
                : (product.care ?? 'Follow the care label sewn into the garment.')}
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="delivery">
        <AccordionTrigger>{isBn ? 'ডেলিভারি ও রিটার্ন' : 'Delivery and returns'}</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3 type-body text-fg-muted">
            <p>
              {isBn
                ? 'আমাদের টিম ডেলিভারির আগে প্রতিটি অর্ডার নিশ্চিত করে (সাধারণত কয়েক ঘণ্টার মধ্যে)। আমরা সাইজ এবং ঠিকানা নিশ্চিত করতে আপনাকে ফোন করব।'
                : 'Every order is confirmed by our team before it ships, usually within a couple of hours. We will call you to check the size and the address.'}
            </p>
            <p>
              {isBn
                ? 'সাইজ পছন্দ না হলে বা মানানসই না হলে সাইজ পরিবর্তনের সহজ সুবিধা রয়েছে। পোশাকটি অবশ্যই অপ্রযুক্ত এবং ট্যাগযুক্ত থাকতে হবে।'
                : 'If the size is not right, exchange it for another. Pieces must be unworn with the tags attached.'}
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
