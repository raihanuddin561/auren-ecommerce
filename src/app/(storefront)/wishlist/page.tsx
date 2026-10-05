import type { Metadata } from 'next';
import { WishlistView } from './wishlist-view';

export const metadata: Metadata = {
  title: 'Wishlist',
  robots: { index: false, follow: true },
};

/** The pieces saved on this device. Static shell: the list lives in the browser until accounts arrive. */
export default function WishlistPage() {
  return (
    <section className="container-page py-12 md:py-20">
      <p className="type-eyebrow text-accent-text">Wishlist</p>
      <h1 className="mt-3 mb-10 type-h1 text-fg md:mb-14">Saved for later</h1>
      <WishlistView />
    </section>
  );
}
