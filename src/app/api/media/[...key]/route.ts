import { connection } from 'next/server';
import { env } from '@/lib/env';
import { localMediaRoot } from '@/lib/media';
import { serveLocalPublic } from '@/lib/media/serve';

/**
 * Local development media (ADR-026): files stored under MEDIA_LOCAL_DIR. With a Vercel Blob token
 * configured, or in production, this route does not exist: public media is served from the Blob
 * store host.
 */
export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  await connection();
  if (env.BLOB_READ_WRITE_TOKEN || env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }
  const { key } = await context.params;
  return serveLocalPublic(localMediaRoot(), key);
}
