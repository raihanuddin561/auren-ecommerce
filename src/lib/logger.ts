import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { env } from './env';
import { scrubMessage } from './observability/scrub';
import { isPiiKey } from './pii';
import { isSensitiveKey } from './sensitive';

/** Correlation values (requestId, userId, orderId...) attached to every log line in a request. */
type LogContext = Record<string, string | number | boolean | null | undefined>;

const storage = new AsyncLocalStorage<LogContext>();

export const REDACTED_PATHS = [
  'password',
  'newPassword',
  'token',
  'secret',
  'authorization',
  'cookie',
  'phone',
  'email',
  '*.password',
  '*.newPassword',
  '*.token',
  '*.secret',
  '*.authorization',
  '*.cookie',
  '*.phone',
  '*.email',
  '*.apiKey',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
];

interface PrismaLikeError {
  code?: unknown;
  meta?: { target?: unknown };
  clientVersion?: unknown;
}

const isPrismaError = (err: Error): err is Error & PrismaLikeError =>
  err.name.startsWith('PrismaClient') || 'clientVersion' in err;

/**
 * Errors are logged without anything that could carry personal data. A Prisma error keeps only its
 * class, `code` and `meta.target` (the violated constraint): its message quotes the query and the
 * values. Everything else keeps its class, a scrubbed message and a scrubbed stack.
 */
export function serializeError(value: unknown): Record<string, unknown> {
  if (!(value instanceof Error))
    return { type: typeof value, message: scrubMessage(String(value)) };
  if (isPrismaError(value)) {
    const target = value.meta?.target;
    return {
      type: value.name,
      ...(typeof value.code === 'string' ? { code: value.code } : {}),
      ...(typeof target === 'string' || Array.isArray(target) ? { target } : {}),
    };
  }
  const code = (value as { code?: unknown }).code;
  return {
    type: value.name,
    ...(typeof code === 'string' ? { code } : {}),
    message: scrubMessage(value.message),
    ...(value.stack ? { stack: value.stack.split('\n').map(scrubMessage).join('\n') } : {}),
  };
}

/** Copies a log object with every personal or secret field replaced, to a bounded depth. */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  // Errors are shaped by the err serializer (which keeps only safe fields): leave them alone.
  if (value instanceof Error) return value;
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isPiiKey(key) || isSensitiveKey(key) ? '[redacted]' : redactDeep(item, depth + 1),
    ]),
  );
}

export function createLogger(options: LoggerOptions = {}, destination?: DestinationStream): Logger {
  const config: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { service: 'auren' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    serializers: { err: serializeError, error: serializeError, cause: serializeError },
    // Personal data and secrets are removed at any depth, not only at the paths listed above.
    formatters: { log: (object) => redactDeep(object) as Record<string, unknown> },
    mixin: () => storage.getStore() ?? {},
    ...options,
  };
  return destination ? pino(config, destination) : pino(config);
}

export const logger: Logger = createLogger();

/** Runs `fn` so every log line inside it carries `context`. Nested calls merge. */
export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return storage.run({ ...storage.getStore(), ...context }, fn);
}

export const getLogContext = (): LogContext => ({ ...storage.getStore() });
