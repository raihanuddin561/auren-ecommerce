import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BRAND_COLORS } from '@/lib/brand';
import { LanguageProvider } from '@/lib/i18n/context';
import { getStoreGeneralSettingsForStorefront } from '@/modules/settings/queries';
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

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  let defaultLocale: 'en' | 'bn' = 'en';
  try {
    const settings = await getStoreGeneralSettingsForStorefront();
    defaultLocale = settings.defaultLanguage ?? 'en';
  } catch {
    defaultLocale = 'en';
  }

  return (
    <html lang={defaultLocale} className={`${fontClassNames} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <LanguageProvider defaultLocale={defaultLocale}>
          <TooltipProvider>{children}</TooltipProvider>
        </LanguageProvider>
        <Toaster />
      </body>
    </html>
  );
}
