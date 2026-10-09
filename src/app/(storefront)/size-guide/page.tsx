import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SizeGuideTables } from './size-guide-tables';

export const metadata: Metadata = {
  title: 'Size & Fit Guide Hub | AUREN',
  description:
    'Comprehensive sizing charts, garment measurement matrices, and measuring instructions for AUREN shirts, trousers, and tailored blazers.',
  alternates: { canonical: '/size-guide' },
};

export default function SizeGuidePage() {
  return (
    <article className="pt-8 pb-24 md:pt-14 md:pb-32">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow text-accent-text">Precision Sizing</p>
          <h1 className="mt-4 type-display-lg font-display text-fg">Size & Fit Guide</h1>
          <p className="mt-4 type-body text-pretty text-fg-muted md:text-lg">
            AUREN pieces are cut with modern tailored proportions designed for comfort in the
            tropics and ease of international travel. Review our garment dimensions or consult our
            concierge.
          </p>
        </header>

        {/* Measurement Tables */}
        <section className="mx-auto mt-14 max-w-4xl">
          <SizeGuideTables />
        </section>

        {/* How to Measure Section */}
        <section className="mx-auto mt-20 max-w-3xl border-t border-line pt-16 md:mt-28 md:pt-20">
          <div className="text-center">
            <p className="type-eyebrow text-accent-text">Guidelines</p>
            <h2 className="mt-2 type-h2 font-display text-fg">How to Measure Accurately</h2>
            <p className="mt-3 type-body text-fg-muted">
              Use a flexible fabric measuring tape and keep the tape snug but not tight.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="border border-line bg-raised/30 p-6">
              <span className="type-eyebrow text-accent-text">CHEST</span>
              <h3 className="mt-2 type-h3 font-medium text-fg">Chest Circumference</h3>
              <p className="mt-2 type-small text-fg-muted">
                Wrap the tape around the fullest part of your chest, directly under the armpits.
                Keep the tape horizontal across your shoulder blades.
              </p>
            </div>

            <div className="border border-line bg-raised/30 p-6">
              <span className="type-eyebrow text-accent-text">COLLAR</span>
              <h3 className="mt-2 type-h3 font-medium text-fg">Neck / Collar</h3>
              <p className="mt-2 type-small text-fg-muted">
                Measure around the base of your neck where your shirt collar naturally sits. Insert
                one finger between your neck and the tape for comfortable breathing ease.
              </p>
            </div>

            <div className="border border-line bg-raised/30 p-6">
              <span className="type-eyebrow text-accent-text">WAIST</span>
              <h3 className="mt-2 type-h3 font-medium text-fg">Trouser Waist</h3>
              <p className="mt-2 type-small text-fg-muted">
                Measure where you prefer to wear your trousers—usually 1 to 2 inches below the navel
                for mid-rise tailoring. Do not hold your breath.
              </p>
            </div>

            <div className="border border-line bg-raised/30 p-6">
              <span className="type-eyebrow text-accent-text">INSEAM</span>
              <h3 className="mt-2 type-h3 font-medium text-fg">Trouser Inseam</h3>
              <p className="mt-2 type-small text-fg-muted">
                Measure from the highest point of your inner thigh down to the ankle bone or top of
                the shoe where you prefer the trouser break to fall.
              </p>
            </div>
          </div>
        </section>

        {/* Personalized Fit Consultation Banner */}
        <section className="mx-auto mt-16 max-w-3xl rounded-xs border border-line bg-raised/50 p-8 text-center md:p-12">
          <h2 className="type-h2 font-display text-fg">Unsure of Your Exact Size?</h2>
          <p className="mx-auto mt-2 max-w-md type-body text-fg-muted">
            Send your height, weight, and favorite garment brand to our concierge. We will recommend
            your precise AUREN size before you place an order.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/contact">Ask Stylist on WhatsApp</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/returns">Learn about 7-Day Doorstep Exchange</Link>
            </Button>
          </div>
        </section>
      </div>
    </article>
  );
}
