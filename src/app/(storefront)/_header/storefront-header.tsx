import { Suspense } from 'react';
import { Header } from '@/components/storefront/header';
import { getNavigationForStorefront } from '@/modules/settings/queries';

export async function StorefrontHeader() {
  const navigation = await getNavigationForStorefront();
  return <Header items={navigation.items} />;
}

export function StorefrontHeaderSuspense() {
  return (
    <Suspense
      fallback={
        <div
          aria-hidden="true"
          className="sticky top-0 z-40 h-(--header-height) border-b border-line bg-page"
        />
      }
    >
      <StorefrontHeader />
    </Suspense>
  );
}
