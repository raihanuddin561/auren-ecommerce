import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { env } from './env';

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

export function createLogger(options: LoggerOptions = {}, destination?: DestinationStream): Logger {
  const config: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { service: 'auren' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
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
