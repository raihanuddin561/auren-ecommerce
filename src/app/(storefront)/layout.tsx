import type { Metadata } from 'next';
import { StorefrontShell } from '@/components/storefront/storefront-shell';
import { siteOrigin } from '@/lib/seo/jsonld';

// Canonical and Open Graph addresses are resolved against the public site address.
export const metadata: Metadata = { metadataBase: new URL(siteOrigin()) };

export default function StorefrontLayout({ children }: LayoutProps<'/'>) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
