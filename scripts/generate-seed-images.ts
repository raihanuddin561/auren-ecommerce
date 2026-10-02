/**
 * Writes the placeholder product images used by the development seed to public/seed.
 * One 4:5 SVG per colour; the committed output means contributors never need to run this.
 *
 *   pnpm exec tsx scripts/generate-seed-images.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { COLORS } from '../prisma/seed-data';

const outDir = path.join(process.cwd(), 'public', 'seed');
mkdirSync(outDir, { recursive: true });

/** Light backgrounds need dark type and vice versa. */
function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0f0f0f' : '#f6f2eb';
}

for (const color of Object.values(COLORS)) {
  const ink = readableOn(color.hex);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${color.label} placeholder">
  <rect width="800" height="1000" fill="${color.hex}"/>
  <text x="400" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="44" letter-spacing="18" fill="${ink}">AUREN</text>
  <text x="400" y="530" text-anchor="middle" font-family="Georgia, serif" font-size="22" letter-spacing="4" fill="${ink}" opacity="0.7">${color.label.toUpperCase()}</text>
</svg>
`;
  writeFileSync(path.join(outDir, `${color.value}.svg`), svg);
}
console.log(`Wrote ${Object.keys(COLORS).length} placeholder images to public/seed`);
