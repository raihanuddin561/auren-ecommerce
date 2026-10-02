import { Cormorant_Garamond, Manrope, Noto_Sans_Bengali } from 'next/font/google';

/**
 * Self-hosted by next/font at build time (no request to Google from the browser). The fallback
 * metrics are adjusted automatically, so swapping in the web font causes no layout shift.
 */
export const fontDisplay = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
  variable: '--font-cormorant',
});

export const fontSans = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

/**
 * Manrope has no taka sign (U+09F3), so prices fall back to a system glyph that sits low and small.
 * This Bengali face supplies it; unicode-range keeps it off the wire for pages without the glyph.
 */
export const fontBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
  variable: '--font-bengali',
});

export const fontClassNames = `${fontDisplay.variable} ${fontSans.variable} ${fontBengali.variable}`;
