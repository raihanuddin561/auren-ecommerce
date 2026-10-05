import type { Metadata } from 'next';
import { LookupForm } from '@/components/storefront/order/track-forms';

export const metadata: Metadata = {
  title: 'Track your order',
  robots: { index: false, follow: false },
};

/** Guest order lookup: order number plus the phone or email used. Shows status only. */
export default function TrackPage() {
  return (
    <section className="container-page py-12 md:py-20">
      <p className="type-eyebrow text-accent-text">Track your order</p>
      <h1 className="mt-3 type-h1 text-fg">Where is my order?</h1>
      <p className="mt-4 mb-10 max-w-xl type-body text-fg-muted">
        Enter your order number and the phone number or email you used. For the full details of an
        order, open the link in your confirmation email.
      </p>
      <LookupForm />
    </section>
  );
}
