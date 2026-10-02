import type { Metadata } from 'next';
import { AdminThemeScope } from '@/components/admin/shell/theme';
import { ADMIN_THEME_INIT_SCRIPT } from '@/lib/admin-theme';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <>
      {/* Applies the saved light/dark choice before first paint, so there is no flash. */}
      <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_INIT_SCRIPT }} />
      <AdminThemeScope />
      {children}
    </>
  );
}
