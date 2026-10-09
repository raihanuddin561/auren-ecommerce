import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Shipping & Delivery Policy | AUREN',
  description:
    'Comprehensive delivery details, timelines, rates, and cash-on-delivery guidelines across all 64 districts in Bangladesh.',
  alternates: { canonical: '/shipping' },
};

export default function ShippingPage() {
  return (
    <article className="pt-8 pb-24 md:pt-14 md:pb-32">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow text-accent-text">Client Care</p>
          <h1 className="mt-4 type-display-lg font-display text-fg">Shipping & Delivery</h1>
          <p className="mt-4 type-body text-pretty text-fg-muted md:text-lg">
            Every AUREN piece is inspected, hand-steamed, and packaged in protective garment covers
            before priority dispatch.
          </p>
        </header>

        {/* Rates & Timelines Grid */}
        <section className="mx-auto mt-14 max-w-4xl">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="border border-line bg-raised/40 p-8">
              <span className="type-eyebrow text-accent-text">DHAKA METROPOLITAN</span>
              <h2 className="mt-2 type-h2 font-display text-fg">Inside Dhaka</h2>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="type-display-lg font-mono text-fg">৳80</span>
                <span className="type-small text-fg-muted">per order</span>
              </div>
              <ul className="mt-6 space-y-3 type-small text-fg-muted">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  Estimated delivery within <strong>24 to 48 hours</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  Complimentary delivery on orders over <strong>৳5,000</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  Cash on Delivery & contactless mobile payments
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  Personal phone confirmation prior to rider dispatch
                </li>
              </ul>
            </div>

            <div className="border border-line bg-raised/40 p-8">
              <span className="type-eyebrow text-accent-text">ALL OTHER DISTRICTS</span>
              <h2 className="mt-2 type-h2 font-display text-fg">Outside Dhaka</h2>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="type-display-lg font-mono text-fg">৳150</span>
                <span className="type-small text-fg-muted">per order</span>
              </div>
              <ul className="mt-6 space-y-3 type-small text-fg-muted">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  Estimated delivery within <strong>48 to 72 hours</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  Complimentary delivery on orders over <strong>৳5,000</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  Insured courier network: Pathao Express & Steadfast
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-gold" />
                  Real-time SMS and live tracking updates
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Detailed Guidelines */}
        <section className="mx-auto mt-16 max-w-3xl space-y-12">
          <div>
            <h2 className="type-h2 font-display text-fg">
              1. Order Verification & Dispatch Protocol
            </h2>
            <p className="mt-3 type-body text-pretty text-fg-muted">
              Because luxury menswear is deeply personal and sizing must be exact, every order
              undergoes a courteous phone verification from our atelier team. We verify your chest,
              waist, and collar measurements to ensure you receive the ideal fit on the first
              delivery.
            </p>
            <p className="mt-2 type-body text-pretty text-fg-muted">
              Once verified, your order enters our fulfillment schedule and is handed over to our
              trusted courier partners (Pathao and Steadfast Couriers) on the same or following
              business morning.
            </p>
          </div>

          <div>
            <h2 className="type-h2 font-display text-fg">2. Discreet & Protective Packaging</h2>
            <p className="mt-3 type-body text-pretty text-fg-muted">
              All tailoring (suits, blazers, trousers) is shipped in dust-proof garment bags with
              sturdy wooden hangers to preserve the architectural drape. Knitwear and shirts are
              wrapped in acid-free tissue paper inside reinforced water-resistant outer boxes.
            </p>
          </div>

          <div>
            <h2 className="type-h2 font-display text-fg">3. Doorstep Inspection Policy</h2>
            <p className="mt-3 type-body text-pretty text-fg-muted">
              For Cash on Delivery orders, you may inspect the outer package and seal in the
              presence of the delivery agent. If the package shows signs of external tampering, you
              may refuse delivery and notify our concierge immediately.
            </p>
          </div>

          <div>
            <h2 className="type-h2 font-display text-fg">4. Real-time Order Tracking</h2>
            <p className="mt-3 type-body text-pretty text-fg-muted">
              You will receive an automated SMS with your consignment tracking code as soon as the
              courier scans your package. You can also view live delivery milestones directly at our
              tracking portal:
            </p>
            <div className="mt-4">
              <Button asChild variant="secondary">
                <Link href="/track">Track your consignment</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
