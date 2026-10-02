import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/nextjs';
import { isSensitiveKey } from '../sensitive';

type TransactionEvent = Parameters<NonNullable<BrowserOptions['beforeSendTransaction']>>[0];

const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-csrf-token',
  'x-forwarded-for',
  'x-real-ip',
  'x-vercel-forwarded-for',
];

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveKey(key) || /^(e-?mail|phone)$/i.test(key)
        ? '[redacted]'
        : scrubValue(item, depth + 1),
    ]),
  );
}

/** Drops the query string and fragment: reset and verification links carry one-time tokens there. */
export function stripQuery(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}

type EventWithRequest = ErrorEvent | TransactionEvent;

function scrubRequest<T extends EventWithRequest>(event: T): T {
  if (!event.request) return event;
  const headers = { ...(event.request.headers ?? {}) };
  for (const name of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.includes(name.toLowerCase())) delete headers[name];
  }
  event.request = { ...event.request, headers };
  delete event.request.cookies;
  delete event.request.data;
  delete event.request.query_string;
  if (event.request.url) event.request.url = stripQuery(event.request.url);
  return event;
}

/**
 * Removes credentials and personal data from an error event before it leaves the server or
 * browser: auth headers, cookies, client addresses, request bodies and query strings, user
 * email/phone/IP, and any context key that looks sensitive. Passed to Sentry's `beforeSend`.
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  scrubRequest(event);
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  return event;
}

/** Same rules for performance transactions (`beforeSendTransaction`). */
export function scrubTransaction<T extends TransactionEvent>(event: T): T {
  scrubRequest(event);
  if (event.transaction) event.transaction = stripQuery(event.transaction);
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  return event;
}

/** Navigation and fetch breadcrumbs record URLs; strip their query strings (`beforeBreadcrumb`). */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data ? { ...breadcrumb.data } : undefined;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = stripQuery(data[key] as string);
    }
    breadcrumb.data = data;
  }
  if (breadcrumb.category === 'console' || breadcrumb.category === 'xhr') {
    // Console output and request bodies are free text that can contain anything.
    delete breadcrumb.message;
  }
  return breadcrumb;
}
