/**
 * Writes high-fashion luxury atelier textile specimen images to public/seed.
 * One 4:5 SVG per colour; formatted as an architectural sartorial blueprint.
 *
 *   pnpm exec tsx scripts/generate-seed-images.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COLORS } from '../prisma/seed-data';

const outDir = path.join(process.cwd(), 'public', 'seed');
mkdirSync(outDir, { recursive: true });

function readableOn(hex: string): { fg: string; fgMuted: string; gold: string; border: string } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  const isLight = luminance > 150;
  return {
    fg: isLight ? '#0f0f0f' : '#f6f2eb',
    fgMuted: isLight ? 'rgba(15, 15, 15, 0.65)' : 'rgba(246, 242, 235, 0.65)',
    gold: isLight ? '#8a6d41' : '#d9c7a6',
    border: isLight ? 'rgba(15, 15, 15, 0.15)' : 'rgba(246, 242, 235, 0.18)',
  };
}

for (const [key, color] of Object.entries(COLORS)) {
  const palette = readableOn(color.hex);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${color.label} tailoring textile specimen">
  <defs>
    <!-- Textile weave pattern -->
    <pattern id="weave-${key}" width="16" height="16" patternUnits="userSpaceOnUse" opacity="0.08">
      <path d="M0 8h16M8 0v16" stroke="${palette.fg}" stroke-width="1.5"/>
      <path d="M0 0l16 16M16 0L0 16" stroke="${palette.fg}" stroke-width="0.75"/>
    </pattern>
    <radialGradient id="grad-${key}" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>
    </radialGradient>
  </defs>

  <!-- Base tone fill -->
  <rect width="800" height="1000" fill="${color.hex}"/>
  <!-- Ambient depth gradient -->
  <rect width="800" height="1000" fill="url(#grad-${key})"/>
  <!-- Textile weave texture -->
  <rect width="800" height="1000" fill="url(#weave-${key})"/>

  <!-- Atelier Hairline Inset Frame -->
  <rect x="36" y="36" width="728" height="928" fill="none" stroke="${palette.border}" stroke-width="1"/>
  <rect x="44" y="44" width="712" height="912" fill="none" stroke="${palette.gold}" stroke-width="0.75" stroke-dasharray="6 4" opacity="0.45"/>

  <!-- Corner Sartorial Crossmarks -->
  <path d="M30 36h12 M36 30v12 M758 36h12 M764 30v12 M30 964h12 M36 958v12 M758 964h12 M764 958v12" stroke="${palette.gold}" stroke-width="1.5"/>

  <!-- Top Atelier Provenance Header -->
  <text x="400" y="90" text-anchor="middle" font-family="'Manrope', -apple-system, sans-serif" font-size="13" font-weight="600" letter-spacing="7" fill="${palette.gold}">✦ AUREN ATELIER ARCHIVE ✦</text>
  <text x="400" y="112" text-anchor="middle" font-family="'Manrope', -apple-system, sans-serif" font-size="11" font-weight="400" letter-spacing="4" fill="${palette.fgMuted}">NOBLE FIBER SPECIMEN • DHAKA</text>

  <!-- Central Watermark / Tailored Lapel Vector Silhouette -->
  <g transform="translate(320, 270)" stroke="${palette.gold}" stroke-width="1.2" fill="none" opacity="0.35">
    <!-- Tailored jacket neckline & lapel contour -->
    <path d="M80 0 L110 50 L140 120 L155 230 L80 230 L5 230 L20 120 L50 50 Z" />
    <path d="M80 0 L80 230" stroke-dasharray="4 3"/>
    <path d="M45 55 L75 140" />
    <path d="M115 55 L85 140" />
    <!-- Monogram Seal Center -->
    <circle cx="80" cy="115" r="28" stroke="${palette.gold}" stroke-width="1"/>
    <text x="80" y="123" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-weight="300" fill="${palette.gold}">A</text>
  </g>

  <!-- Typography Block -->
  <text x="400" y="590" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="46" font-weight="300" letter-spacing="14" fill="${palette.fg}">AUREN</text>
  
  <line x1="320" y1="615" x2="480" y2="615" stroke="${palette.gold}" stroke-width="1" opacity="0.7"/>

  <text x="400" y="655" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="26" font-style="italic" letter-spacing="3" fill="${palette.fg}">${color.label}</text>
  <text x="400" y="688" text-anchor="middle" font-family="'Manrope', -apple-system, sans-serif" font-size="11" font-weight="500" letter-spacing="5" fill="${palette.fgMuted}">TEXTILE SPECIMEN • NATURAL WEAVE</text>

  <!-- Bottom Details Stamp -->
  <text x="400" y="900" text-anchor="middle" font-family="'Manrope', -apple-system, sans-serif" font-size="10" font-weight="500" letter-spacing="4" fill="${palette.fgMuted}">BESPOKE &amp; READY-TO-WEAR • BANANI STUDIO</text>
  <text x="400" y="920" text-anchor="middle" font-family="'Manrope', -apple-system, sans-serif" font-size="9" font-weight="400" letter-spacing="2" fill="${palette.gold}">HAND-FINISHED SEAMS • ZERO SYNTHETIC BLENDS</text>
</svg>
`;
  writeFileSync(path.join(outDir, `${color.value}.svg`), svg);
}
console.log(`Wrote ${Object.keys(COLORS).length} luxury atelier specimen images to public/seed`);
