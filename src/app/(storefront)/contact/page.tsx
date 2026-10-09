import type { Metadata } from 'next';
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Client Concierge & Atelier Consultations | AUREN',
  description:
    'Connect with the AUREN client concierge for private fittings, styling consultations, order verification inquiries, and bespoke corporate commissions.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <article className="pt-8 pb-24 md:pt-14 md:pb-32">
      <div className="container-page">
        <header className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow text-accent-text">Dedicated Assistance</p>
          <h1 className="mt-4 type-display-lg font-display text-fg">Client Concierge</h1>
          <p className="mt-4 type-body text-pretty text-fg-muted md:text-lg">
            Whether you require personal styling advice, measurement guidance, or wish to schedule a
            private studio fitting in Dhaka, our concierge is at your service.
          </p>
        </header>

        <div className="mt-14 grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Direct Concierge Channels (Left) */}
          <div className="space-y-8 lg:col-span-5">
            <div>
              <h2 className="type-h2 font-display text-fg">Direct Channels</h2>
              <p className="mt-2 type-body text-fg-muted">
                Available Saturday through Thursday from 10:00 AM to 9:00 PM (Dhaka Time).
              </p>
            </div>

            <div className="space-y-4">
              <a
                href="https://wa.me/8801700000000?text=Hello%20AUREN%20Concierge,%20I%20would%20like%20assistance."
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 border border-line bg-raised/40 p-5 transition-auren-fast hover:border-gold hover:bg-raised"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xs border border-line bg-page text-accent-text transition-colors group-hover:border-gold">
                  <Icon icon={MessageSquare} size={20} />
                </div>
                <div>
                  <span className="type-eyebrow text-accent-text">INSTANT MESSAGING</span>
                  <p className="mt-1 type-h3 font-medium text-fg">WhatsApp Concierge</p>
                  <p className="mt-1 type-small text-fg-muted">
                    Immediate replies for sizing, photo requests, and order tracking.
                  </p>
                  <span className="mt-2 inline-block type-small font-mono text-gold underline">
                    +880 1700-000000
                  </span>
                </div>
              </a>

              <a
                href="tel:+8801700000000"
                className="group flex items-start gap-4 border border-line bg-raised/40 p-5 transition-auren-fast hover:border-gold hover:bg-raised"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xs border border-line bg-page text-accent-text transition-colors group-hover:border-gold">
                  <Icon icon={Phone} size={20} />
                </div>
                <div>
                  <span className="type-eyebrow text-accent-text">TELEPHONE</span>
                  <p className="mt-1 type-h3 font-medium text-fg">Concierge Hotline</p>
                  <p className="mt-1 type-small text-fg-muted">
                    Direct voice support for phone orders and urgent requests.
                  </p>
                  <span className="mt-2 inline-block type-small font-mono text-fg">
                    +880 1700-000000
                  </span>
                </div>
              </a>

              <a
                href="mailto:concierge@aurenbd.com"
                className="group flex items-start gap-4 border border-line bg-raised/40 p-5 transition-auren-fast hover:border-gold hover:bg-raised"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xs border border-line bg-page text-accent-text transition-colors group-hover:border-gold">
                  <Icon icon={Mail} size={20} />
                </div>
                <div>
                  <span className="type-eyebrow text-accent-text">ELECTRONIC MAIL</span>
                  <p className="mt-1 type-h3 font-medium text-fg">Atelier Inquiries</p>
                  <p className="mt-1 type-small text-fg-muted">concierge@aurenbd.com</p>
                </div>
              </a>

              <div className="flex items-start gap-4 border border-line bg-raised/40 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xs border border-line bg-page text-accent-text">
                  <Icon icon={MapPin} size={20} />
                </div>
                <div>
                  <span className="type-eyebrow text-accent-text">STUDIO ATELIER</span>
                  <p className="mt-1 type-h3 font-medium text-fg">Dhaka Showroom</p>
                  <p className="mt-1 type-small text-fg-muted">
                    Road 11, Banani, Dhaka 1213, Bangladesh.
                    <br />
                    <em>Private fittings strictly by appointment.</em>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Inquiry Form (Right) */}
          <div className="border border-line bg-raised/30 p-8 lg:col-span-7 lg:p-10">
            <h2 className="type-h2 font-display text-fg">Send a Direct Inquiry</h2>
            <p className="mt-2 type-body text-fg-muted">
              Leave your details and inquiry below. A concierge specialist will respond within 4
              business hours.
            </p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
