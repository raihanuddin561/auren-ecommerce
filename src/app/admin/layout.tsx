import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import { AdminThemeScope } from '@/components/admin/shell/theme';
import { ADMIN_THEME_INIT_SCRIPT } from '@/lib/admin-theme';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

/**
 * The console is rendered per request, never prerendered: its Content-Security-Policy carries a
 * per-request nonce (ADR-022), which a static shell cannot receive. `instant = false` allows this
 * blocking route.
 */
export const instant = false;

export default async function AdminRootLayout({ children }: LayoutProps<'/admin'>) {
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <>
      {/* Applies the saved light/dark choice before first paint, so there is no flash. */}
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: ADMIN_THEME_INIT_SCRIPT }} />
      <AdminThemeScope />
      {children}
    </>
  );
}
