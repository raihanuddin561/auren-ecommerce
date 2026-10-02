import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/storefront/not-found-content';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

/** Used by notFound() inside storefront pages, which already sit in the storefront shell. */
export default function StorefrontNotFound() {
  return <NotFoundContent />;
}
