import { StorefrontShell } from '@/components/storefront/storefront-shell';

export default function StorefrontLayout({ children }: LayoutProps<'/'>) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
