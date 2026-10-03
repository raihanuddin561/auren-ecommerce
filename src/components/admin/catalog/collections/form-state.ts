import type { CollectionRules } from '@/modules/catalog/collection-rules';
import { slugify } from '@/modules/catalog/slug';
import { cleanRules, EMPTY_MANUAL_RULES } from './rules-state';

/** Pure form logic of the collection screen: values, publish dates and the action payload. */

export const SORT_OPTIONS = [
  { value: 'manual', label: 'Manual order' },
  { value: 'best_selling', label: 'Best selling' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
] as const;

export type CollectionSortValue = (typeof SORT_OPTIONS)[number]['value'];
export type CollectionTypeValue = 'manual' | 'automatic';
export type PublishMode = 'draft' | 'keep' | 'now' | 'schedule';

export interface CollectionFormValues {
  title: string;
  slug: string;
  description: string;
  type: CollectionTypeValue;
  rules: CollectionRules;
  sortOrder: CollectionSortValue;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
  publishMode: PublishMode;
  /** datetime-local text such as 2026-10-12T09:30, in the browser's time zone. */
  scheduledAt: string;
}

export const emptyValues = (): CollectionFormValues => ({
  title: '',
  slug: '',
  description: '',
  type: 'manual',
  rules: { ...EMPTY_MANUAL_RULES },
  sortOrder: 'manual',
  isFeatured: false,
  seoTitle: '',
  seoDescription: '',
  publishMode: 'draft',
  scheduledAt: '',
});

const pad = (n: number) => String(n).padStart(2, '0');

/** An ISO timestamp as the value of a datetime-local input (local time, minutes). */
export function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A datetime-local value as an ISO string with an offset, or null when it is not a date. */
export function localInputToIso(value: string): string | null {
  if (value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** What the address will be: the typed slug, else one derived from the title. */
export function slugPreview(title: string, slug: string): string {
  const typed = slugify(slug);
  return typed !== '' ? typed : slugify(title);
}

export interface PublishContext {
  /** The saved publish date, if the collection is already scheduled or live. */
  savedPublishedAt: string | null;
  now: Date;
}

/** The publishedAt to send, or an error sentence when the chosen mode is not usable. */
export function resolvePublishedAt(
  values: Pick<CollectionFormValues, 'publishMode' | 'scheduledAt'>,
  context: PublishContext,
): { ok: true; publishedAt: string | null } | { ok: false; message: string } {
  switch (values.publishMode) {
    case 'draft':
      return { ok: true, publishedAt: null };
    case 'keep':
      return { ok: true, publishedAt: context.savedPublishedAt };
    case 'now':
      return { ok: true, publishedAt: context.now.toISOString() };
    case 'schedule': {
      const iso = localInputToIso(values.scheduledAt);
      if (iso === null) return { ok: false, message: 'Choose a date and time to publish.' };
      if (new Date(iso).getTime() <= context.now.getTime()) {
        return { ok: false, message: 'Choose a time in the future, or publish now.' };
      }
      return { ok: true, publishedAt: iso };
    }
  }
}

/** The whole-form payload of createCollection and updateCollection (the id is added by the caller). */
export function buildPayload(values: CollectionFormValues, publishedAt: string | null) {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    description: values.description,
    type: values.type,
    // Manual collections carry no rules.
    rules: values.type === 'automatic' ? cleanRules(values.rules) : { ...EMPTY_MANUAL_RULES },
    sortOrder: values.sortOrder,
    // The server schema reads an empty string as "no date" (a draft); it rejects null.
    publishedAt: publishedAt ?? '',
    isFeatured: values.isFeatured,
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
  };
}

export type CollectionPayload = ReturnType<typeof buildPayload>;
