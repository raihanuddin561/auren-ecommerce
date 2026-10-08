import { PhoneCall, RefreshCw, ShieldCheck, Truck } from 'lucide-react';
import { Icon } from '@/components/ui/icon';

const PERKS = [
  {
    icon: ShieldCheck,
    title: 'Artisan Natural Fibers',
    description: 'Egyptian cotton, breathable European linen, and pure silks tailored to endure.',
  },
  {
    icon: Truck,
    title: 'Complimentary Delivery',
    description: 'Insured courier delivery across all 64 districts. Complimentary over ৳5,000.',
  },
  {
    icon: PhoneCall,
    title: 'Personal Verification',
    description:
      'Our team calls you personally to confirm measurements and address before dispatch.',
  },
  {
    icon: RefreshCw,
    title: 'Doorstep Size Exchange',
    description:
      '7-day hassle-free exchange at your doorstep if the fit is anything less than perfect.',
  },
] as const;

export function BrandPerks() {
  return (
    <section
      aria-label="The AUREN Standard"
      className="border-y border-line bg-raised/40 py-12 md:py-16"
    >
      <div className="container-page">
        <div className="mx-auto mb-8 max-w-xl text-center md:mb-12">
          <p className="type-eyebrow font-medium tracking-eyebrow text-accent-text uppercase">
            The AUREN Standard
          </p>
          <h2 className="mt-2 type-h2 font-display text-fg">Crafted for Discerning Men</h2>
          <p className="mt-3 type-body text-pretty text-fg-muted">
            Enduring garments and bespoke client care designed for the modern tropics and
            international wardrobes.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {PERKS.map((perk, index) => (
            <div
              key={perk.title}
              className="group relative flex flex-col items-start border-l border-line/80 pl-6 transition-all duration-300 hover:border-gold"
            >
              <div className="flex size-11 items-center justify-center rounded-xs border border-line bg-page text-accent-text transition-colors duration-200 group-hover:border-gold group-hover:bg-gold/10">
                <Icon icon={perk.icon} size={20} />
              </div>
              <span className="mt-4 type-small font-mono text-fg-muted/60">0{index + 1}</span>
              <h3 className="mt-1 type-h3 font-display text-fg">{perk.title}</h3>
              <p className="mt-2 type-small text-pretty text-fg-muted">{perk.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
