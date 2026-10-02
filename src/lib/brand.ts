/**
 * Brand values needed outside CSS (browser chrome colour, PWA manifest). They mirror the tokens
 * in src/styles/globals.css; the token test fails if the two drift apart.
 */
export const BRAND_COLORS = {
  ivory: '#f6f2eb',
  ink: '#0f0f0f',
} as const;
