import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/nextjs';
import { isPiiKey } from '../pii';
import { isSensitiveKey } from '../sensitive';

type TransactionEvent = Parameters<NonNullable<BrowserOptions['beforeSendTransaction']>>[0];

const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'referer',
  'forwarded',
  'x-api-key',
  'x-csrf-token',
  'x-forwarded-for',
  'x-real-ip',
  'x-client-ip',
  'x-vercel-forwarded-for',
  'cf-connecting-ip',
  'true-client-ip',
  'x-turnstile-token',
  'x-webhook-signature',
  'stripe-signature',
];

const MAX_MESSAGE_CHARS = 8_000;

/** Keys whose value is a secret even when it has no recognisable shape. */
const SECRET_NAME =
  '[\\w-]*(?:password|passwd|pwd|secret|token|api[-_]?key|authorization|cookie|otp)[\\w-]*';

const DATABASE_ERROR_START =
  /(?:invalid `prisma\.|PrismaClient\w*Error|Unique constraint failed|Foreign key constraint|Raw query failed|Failed query:|duplicate key value violates)/i;

/**
 * Removes credentials and personal data from free text (exception messages, log messages):
 * connection strings, emails, bearer and basic credentials, key/value and JSON secrets, phone
 * numbers and long token-like strings. Database errors quote queries and their arguments, so
 * those are replaced entirely. File paths, ISO dates and UUIDs are kept readable. Input is cut to
 * a bounded length first so a hostile message cannot make the patterns slow.
 */
export function scrubMessage(text: string): string {
  const input = text.length > MAX_MESSAGE_CHARS ? text.slice(0, MAX_MESSAGE_CHARS) : text;
  if (DATABASE_ERROR_START.test(input)) return 'Database error (details removed)';
  return (
    input
      // scheme://user:password@host
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi, '$1[redacted]@')
      // Authorization: Bearer x / Basic x (the scheme and the credential)
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]')
      // "password":"x", password=x, access_token: x, cookie: a=1; b=2 (to the end of the value)
      .replace(
        new RegExp(`(["']?${SECRET_NAME}["']?\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,;&}]+)`, 'gi'),
        '$1[redacted]',
      )
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
      // phone numbers: international (+...), local 11-digit mobile, or 3-3-4 grouped; never dates
      .replace(
        /(?<![\w-])(?:\+\d[\d\s().-]{7,18}\d|0\d{10}|\d{3}[\s.-]\d{3}[\s.-]\d{4})(?![\w-])/g,
        '[phone]',
      )
      // long token-like strings (paths are untouched: "/" is not part of the class)
      .replace(/[A-Za-z0-9_+=-]{32,}/g, (match) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match)
          ? match
          : '[token]',
      )
  );
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubMessage(value);
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveKey(key) || isPiiKey(key) ? '[redacted]' : scrubValue(item, depth + 1),
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
    const lower = name.toLowerCase();
    if (SENSITIVE_HEADERS.includes(lower) || lower.startsWith('x-vercel-ip-')) delete headers[name];
  }
  event.request = { ...event.request, headers };
  delete event.request.cookies;
  delete event.request.data;
  delete event.request.query_string;
  delete (event.request as { env?: unknown }).env;
  if (event.request.url) event.request.url = stripQuery(event.request.url);
  return event;
}

/** Exception values and messages are free text: scrub them like any other string. */
function scrubMessages(event: ErrorEvent): void {
  if (typeof event.message === 'string') event.message = scrubMessage(event.message);
  if (event.logentry?.message) event.logentry.message = scrubMessage(event.logentry.message);
  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === 'string') exception.value = scrubMessage(exception.value);
  }
}

/**
 * Removes credentials and personal data from an error event before it leaves the server or
 * browser: auth headers, cookies, client addresses, request bodies and query strings, user
 * email/phone/IP, personal data in extra/context/tag values, and exception messages.
 * Passed to Sentry's `beforeSend`.
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  scrubRequest(event);
  scrubMessages(event);
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  if (event.tags) event.tags = scrubValue(event.tags) as typeof event.tags;
  if (event.transaction) event.transaction = stripQuery(event.transaction);
  for (const crumb of event.breadcrumbs ?? []) scrubBreadcrumb(crumb);
  return event;
}

/** Same rules for performance transactions (`beforeSendTransaction`). */
export function scrubTransaction<T extends TransactionEvent>(event: T): T {
  scrubRequest(event);
  if (event.transaction) event.transaction = stripQuery(event.transaction);
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  // Spans carry SQL statements and URLs with values and tokens in them.
  for (const span of event.spans ?? []) {
    if (typeof span.description === 'string')
      span.description = scrubMessage(stripQuery(span.description));
    if (span.data) span.data = scrubValue(span.data) as typeof span.data;
  }
  return event;
}

/** Navigation and fetch breadcrumbs record URLs; strip their query strings (`beforeBreadcrumb`). */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data ? { ...breadcrumb.data } : undefined;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = stripQuery(data[key] as string);
    }
    // console.* arguments and request bodies are free text that can contain anything.
    delete data.arguments;
    breadcrumb.data = scrubValue(data) as typeof data;
  }
  if (breadcrumb.category === 'console' || breadcrumb.category === 'xhr') {
    delete breadcrumb.message;
  } else if (typeof breadcrumb.message === 'string') {
    breadcrumb.message = scrubMessage(breadcrumb.message);
  }
  return breadcrumb;
}
