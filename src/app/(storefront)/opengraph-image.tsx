import { ImageResponse } from 'next/og';
import { OG_THEME } from '@/lib/seo/og-theme';

export const alt = 'AUREN | Quintessential Menswear Atelier';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: OG_THEME.ink,
        padding: '60px',
        position: 'relative',
      }}
    >
      {/* Outer Luxury Border */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          right: '24px',
          bottom: '24px',
          border: `1px solid ${OG_THEME.line}`,
          display: 'flex',
        }}
      />

      {/* Inner Accent Hairline */}
      <div
        style={{
          position: 'absolute',
          top: '32px',
          left: '32px',
          right: '32px',
          bottom: '32px',
          border: `1px solid ${OG_THEME.line}`,
          opacity: 0.5,
          display: 'flex',
        }}
      />

      {/* Brand Monogram / Crest */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            border: `1px solid ${OG_THEME.gold}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: OG_THEME.gold,
            fontSize: '28px',
            fontFamily: 'serif',
            letterSpacing: '2px',
          }}
        >
          A
        </div>
      </div>

      {/* Wordmark */}
      <div
        style={{
          display: 'flex',
          fontSize: '64px',
          letterSpacing: '18px',
          fontWeight: 400,
          color: OG_THEME.ivory,
          fontFamily: 'serif',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}
      >
        AUREN
      </div>

      {/* Atelier Tagline */}
      <div
        style={{
          display: 'flex',
          fontSize: '18px',
          letterSpacing: '8px',
          color: OG_THEME.gold,
          textTransform: 'uppercase',
          fontWeight: 500,
          marginBottom: '48px',
        }}
      >
        Quintessential Menswear Atelier
      </div>

      {/* Pillars Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          paddingTop: '28px',
          borderTop: `1px solid ${OG_THEME.line}`,
          color: OG_THEME.stoneMuted,
          fontSize: '15px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}
      >
        <span>Pure Natural Fibers</span>
        <span style={{ color: OG_THEME.gold }}>•</span>
        <span>Architectural Drape</span>
        <span style={{ color: OG_THEME.gold }}>•</span>
        <span>Dhaka, Bangladesh</span>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
