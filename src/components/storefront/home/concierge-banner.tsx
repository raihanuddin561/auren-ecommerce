import Link from 'next/link';
import { MessageSquare, PhoneCall, RefreshCw } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

export function ConciergeBanner() {
  return (
    <section aria-labelledby="concierge-banner-heading" className="py-16 md:py-24">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-xs border border-line bg-raised/70 p-8 md:p-14 lg:p-16">
            <div className="max-w-2xl">
              <span className="type-eyebrow text-accent-text">Bespoke Client Care</span>
              <h2
                id="concierge-banner-heading"
                className="mt-3 type-display-lg font-display text-fg"
              >
                Personal styling &amp; doorstep fittings.
              </h2>
              <p className="mt-4 type-body text-pretty text-fg-muted md:text-lg">
                Not sure about your size, collar proportions, or which trousers match your blazer?
                Our Dhaka atelier concierge is available on WhatsApp to review your measurements and
                arrange doorstep fitting exchanges.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xs border border-line bg-page text-accent-text">
                    <Icon icon={MessageSquare} size={18} />
                  </div>
                  <span className="type-small font-medium text-fg">WhatsApp Desk</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xs border border-line bg-page text-accent-text">
                    <Icon icon={PhoneCall} size={18} />
                  </div>
                  <span className="type-small font-medium text-fg">Phone Verification</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xs border border-line bg-page text-accent-text">
                    <Icon icon={RefreshCw} size={18} />
                  </div>
                  <span className="type-small font-medium text-fg">7-Day Doorstep Swap</span>
                </div>
              </div>

              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <a
                    href="https://wa.me/8801700000000?text=Hello%20AUREN%20Concierge,%20I%20would%20like%20sizing%20advice."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Icon icon={MessageSquare} size={18} />
                    <span>Chat with Concierge</span>
                  </a>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/size-guide">View Size Matrix</Link>
                </Button>
              </div>
            </div>

            {/* Decorative Monogram Watermark Background */}
            <div
              aria-hidden="true"
              style={{ fontSize: '14rem', lineHeight: 0.8 }}
              className="pointer-events-none absolute -right-10 -bottom-10 font-display font-bold text-fg-muted/5 select-none"
            >
              A
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
