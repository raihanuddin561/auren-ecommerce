import { getJournalRssXmlQuery } from '@/modules/journal/queries';
import { siteOrigin } from '@/lib/seo/jsonld';

export const dynamic = 'force-dynamic';

export async function GET() {
  const origin = siteOrigin();
  const xml = await getJournalRssXmlQuery(origin);

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
