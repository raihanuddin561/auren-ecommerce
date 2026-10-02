import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BRAND_COLORS } from '@/lib/brand';
import { fontClassNames } from './fonts';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'AUREN', template: '%s | AUREN' },
  description: 'Modern, refined menswear. Elevated essentials and tailoring.',
};

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.ivory,
  colorScheme: 'light',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${fontClassNames} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
