import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Returns & Doorstep Size Exchanges | AUREN',
  description:
    'Our effortless 7-day doorstep size exchange policy across Bangladesh. Hassle-free exchanges, transparent refund guidelines, and dedicated client care.',
  alternates: { canonical: '/returns' },
};

export default function ReturnsPage() {
  return (
    <article className="pt-8 pb-24 md:pt-14 md:pb-32">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow text-accent-text">Worry-Free Guarantee</p>
          <h1 className="mt-4 type-display-lg font-display text-fg">Returns & Doorstep Exchange</h1>
          <p className="mt-4 type-body text-pretty text-fg-muted md:text-lg">
            A bespoke garment must feel exceptional. If the fit is anything less than immaculate, we
            exchange it directly at your doorstep within 7 days of delivery.
          </p>
        </header>

        {/* 3-Step Process Flow */}
        <section className="mx-auto mt-14 max-w-4xl">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="border border-line bg-raised/30 p-8">
              <span className="type-display-lg font-mono text-accent-text">01</span>
              <h2 className="mt-4 type-h3 font-medium text-fg">Notify Concierge</h2>
              <p className="mt-2 type-small text-fg-muted">
                Reach out within 7 days of receiving your package via WhatsApp or your order page.
                Mention your desired replacement size.
              </p>
            </div>

            <div className="border border-line bg-raised/30 p-8">
              <span className="type-display-lg font-mono text-accent-text">02</span>
              <h2 className="mt-4 type-h3 font-medium text-fg">Doorstep Swap</h2>
              <p className="mt-2 type-small text-fg-muted">
                Our courier delivers the new size to your address and collects the original garment
                simultaneously. No label printing or postal queues.
              </p>
            </div>

            <div className="border border-line bg-raised/30 p-8">
              <span className="type-display-lg font-mono text-accent-text">03</span>
              <h2 className="mt-4 type-h3 font-medium text-fg">Instant Settlement</h2>
              <p className="mt-2 type-small text-fg-muted">
                If the replacement size is unavailable or you prefer not to exchange, choose full
                store credit or an immediate refund to your original payment method.
              </p>
            </div>
          </div>
        </section>

        {/* Return Conditions */}
        <section className="mx-auto mt-16 max-w-3xl space-y-12">
          <div>
            <h2 className="type-h2 font-display text-fg">Eligible Return Conditions</h2>
            <p className="mt-3 type-body text-pretty text-fg-muted">
              To ensure all customers receive pristine atelier garments, items submitted for return
              or exchange must meet the following criteria:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 type-body text-fg-muted">
              <li>
                <strong>Unworn & Unaltered:</strong> Garments must be tried on indoors only, with no
                cologne scents, marks, or alterations.
              </li>
              <li>
                <strong>Original Tags & Packaging:</strong> Original woven garment tags, spare
                buttons, and dust bags must be intact.
              </li>
              <li>
                <strong>Within the 7-day window:</strong> The request must be logged within 7 days
                of courier delivery confirmation.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="type-h2 font-display text-fg">Refund Methods & Timelines</h2>
            <div className="mt-4 space-y-4 type-body text-fg-muted">
              <p>
                <strong>Store Credit (Fastest):</strong> Issued immediately upon inspection. Valid
                forever across all future collections and drops.
              </p>
              <p>
                <strong>bKash / Nagad / Bank Transfer:</strong> Processed within 3 to 5 business
                days after inspection in our central studio.
              </p>
              <p>
                <strong>Visa / Mastercard:</strong> Refunded to your issuing bank within 7 to 10
                working days, depending on bank processing cycles.
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-12 rounded-xs border border-line bg-raised/50 p-8 text-center md:p-12">
            <h3 className="type-h2 font-display text-fg">Need an Exchange or Sizing Advice?</h3>
            <p className="mx-auto mt-2 max-w-md type-body text-fg-muted">
              Our concierge team is standing by to guide your measurements and arrange your doorstep
              swap.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/contact">Contact Concierge on WhatsApp</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/track">Look up your order</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
