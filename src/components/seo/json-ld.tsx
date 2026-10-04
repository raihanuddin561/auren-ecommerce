import { serializeJsonLd, type JsonLdNode } from '@/lib/seo/jsonld';

/** Structured data for search engines, rendered on the server. Data only: it never runs. */
export function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
