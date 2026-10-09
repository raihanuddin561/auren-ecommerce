import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | AUREN',
  description:
    'Terms and conditions governing the purchase of garments, phone verification, payments, and doorstep exchanges at AUREN.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <article className="pt-8 pb-24 md:pt-14 md:pb-32">
      <div className="container-page">
        <header className="mx-auto max-w-3xl">
          <p className="type-eyebrow text-accent-text">Client Agreement</p>
          <h1 className="mt-4 type-display-lg font-display text-fg">Terms of Service</h1>
          <p className="mt-2 type-small font-mono text-fg-muted">Last updated: October 2026</p>
        </header>

        <div className="mx-auto mt-12 max-w-3xl space-y-10 type-body text-fg-muted">
          <section>
            <h2 className="type-h3 font-display text-fg">1. Agreement to Terms</h2>
            <p className="mt-3">
              By accessing the AUREN website (&quot;Site&quot;) or purchasing garments through our
              digital storefront, telephone desk, or WhatsApp concierge, you agree to be bound by
              these Terms of Service and our associated policies.
            </p>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">
              2. Order Placement & Phone Verification
            </h2>
            <p className="mt-3">
              Submitting an order constitutes an offer to purchase. In accordance with AUREN atelier
              standards, orders enter an <em>under verification</em> status. A sales contract is
              finalized only after a staff verifier conducts telephone confirmation of measurements
              and delivery address with the client.
            </p>
            <p className="mt-2">
              AUREN reserves the right to decline or cancel orders that cannot be verified by phone,
              show indicators of fraudulent intent, or contain pricing errors.
            </p>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">3. Pricing & Currency</h2>
            <p className="mt-3">
              All prices displayed on the storefront are denominated in Bangladeshi Taka (BDT, ৳)
              and include applicable statutory value-added tax (VAT) unless otherwise indicated.
              Delivery fees are clearly itemized prior to final order submission.
            </p>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">4. Delivery & Cash on Delivery</h2>
            <p className="mt-3">
              Delivery schedules (24–48 hours in Dhaka, 48–72 hours outside Dhaka) are estimates
              provided in good faith. For Cash on Delivery orders, payment in full must be tendered
              to the courier representative upon delivery. Consignments cannot be opened or altered
              prior to payment, though outer package seals may be inspected.
            </p>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">5. Returns, Exchanges & Refunds</h2>
            <p className="mt-3">
              Clients are entitled to our 7-day doorstep size exchange policy, provided items remain
              in pristine, unworn condition with all original tags attached. For full particulars,
              consult our dedicated{' '}
              <a href="/returns" className="text-gold underline">
                Returns & Exchanges
              </a>{' '}
              page.
            </p>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">6. Intellectual Property</h2>
            <p className="mt-3">
              All content, photography, typography, trademarks, logos, and garment designs displayed
              on this site are the exclusive intellectual property of AUREN. Reproduction or
              distribution without express written permission is strictly prohibited.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
