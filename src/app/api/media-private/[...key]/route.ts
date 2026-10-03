import { connection } from 'next/server';
import { env } from '@/lib/env';
import { getMediaProvider } from '@/lib/media';
import { servePrivate } from '@/lib/media/serve';

/**
 * Private media (receipts, invoices): reachable only with a short-lived signed link created on the
 * server after an authorization check (provider.signedReadUrl). Never cached, always a download.
 */
export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  await connection();
  const { key } = await context.params;
  const query = new URL(request.url).searchParams;
  return servePrivate(getMediaProvider(), key, query, env.BETTER_AUTH_SECRET);
}
