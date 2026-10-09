import { ImageResponse } from 'next/og';
import { OG_THEME } from '@/lib/seo/og-theme';
import { EMPTY_QUERY } from '@/modules/catalog/listing';
import { listingFor } from '../../_listing/load';

export const alt = 'AUREN Curated Collection';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let title = 'Curated Collection';
  let description = 'Architectural drape and quiet luxury tailoring.';

  try {
    const listing = await listingFor({ kind: 'collection', slug }, EMPTY_QUERY);
    if (listing?.header) {
      title = listing.header.title;
      if (listing.header.description) {
        description = listing.header.description;
      }
    }
  } catch {
    // Fall back to clean default collection copy
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: OG_THEME.ink,
        padding: '56px 64px',
        position: 'relative',
      }}
    >
      {/* Decorative Border */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          bottom: '20px',
          border: `1px solid ${OG_THEME.line}`,
          display: 'flex',
        }}
      />

      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${OG_THEME.line}`,
          paddingBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: '24px',
            fontFamily: 'serif',
            letterSpacing: '8px',
            color: OG_THEME.ivory,
            textTransform: 'uppercase',
          }}
        >
          AUREN
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '13px',
            letterSpacing: '4px',
            color: OG_THEME.gold,
            textTransform: 'uppercase',
          }}
        >
          Curated Capsule
        </div>
      </div>

      {/* Center Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginTop: 'auto',
          marginBottom: 'auto',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            letterSpacing: '5px',
            color: OG_THEME.stoneMuted,
            textTransform: 'uppercase',
          }}
        >
          Seasonal Lookbook
        </div>
        <div
          style={{
            fontSize: title.length > 25 ? '48px' : '60px',
            fontFamily: 'serif',
            color: OG_THEME.ivory,
            lineHeight: 1.15,
            letterSpacing: '1px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '20px',
            color: OG_THEME.stoneMuted,
            maxWidth: '850px',
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>

      {/* Footer Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${OG_THEME.line}`,
          paddingTop: '20px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            letterSpacing: '3px',
            color: OG_THEME.stoneMuted,
            textTransform: 'uppercase',
          }}
        >
          Quintessential Menswear • Dhaka Atelier
        </div>
        <div
          style={{
            fontSize: '13px',
            letterSpacing: '3px',
            color: OG_THEME.gold,
            textTransform: 'uppercase',
          }}
        >
          auren.style
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
