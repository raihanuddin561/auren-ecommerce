import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/storefront/not-found-content';
import { StorefrontShell } from '@/components/storefront/storefront-shell';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

/** Unmatched URLs: no layout wraps them, so this page brings the storefront shell itself. */
export default function NotFound() {
  return (
    <StorefrontShell>
      <NotFoundContent />
    </StorefrontShell>
  );
}
