import { ImageResponse } from 'next/og';
import { BRAND_COLORS } from '@/lib/brand';
import { getProductPage } from '@/modules/catalog/queries';

export const alt = 'AUREN product';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** A quiet typographic card per product: wordmark, collection, title. No stock or price (they change). */
export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductPage(slug);
  const title = product?.title ?? 'AUREN';
  const eyebrow = product?.eyebrow ?? 'Modern menswear';
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: BRAND_COLORS.ivory,
        color: BRAND_COLORS.ink,
        padding: '72px 88px',
      }}
    >
      <div style={{ fontSize: 34, letterSpacing: '0.32em' }}>AUREN</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: 24,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: `${BRAND_COLORS.ink}99`,
            marginBottom: 20,
          }}
        >
          {eyebrow}
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.1, fontFamily: 'serif', maxWidth: 960 }}>
          {title}
        </div>
      </div>
      <div style={{ width: 96, height: 3, background: `${BRAND_COLORS.ink}66` }} />
    </div>,
    size,
  );
}
