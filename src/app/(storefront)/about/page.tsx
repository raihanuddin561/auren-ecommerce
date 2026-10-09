import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Our Story & Atelier Craftsmanship | AUREN',
  description:
    'The story of AUREN: quiet luxury menswear crafted in Dhaka with world-class natural fibers, architectural drape, and master tailoring.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <article className="pt-8 pb-24 md:pt-14 md:pb-32">
      <div className="container-page">
        {/* Editorial Header */}
        <header className="mx-auto max-w-3xl text-center">
          <p className="type-eyebrow text-accent-text">The House of AUREN</p>
          <h1 className="mt-4 type-display-lg font-display text-fg">
            Quiet confidence, crafted to endure.
          </h1>
          <p className="mt-6 type-body text-pretty text-fg-muted md:text-lg">
            AUREN was founded on an uncompromising principle: modern menswear does not need loud
            logos to command respect. It needs impeccable natural fibers, architectural drape, and
            the quiet precision of master tailoring.
          </p>
        </header>

        {/* Hero Imagery Frame */}
        <div className="relative mt-12 aspect-video overflow-hidden rounded-xs border border-line bg-sunken md:mt-16">
          <Image
            src="/editorial/craftsmanship.jpg"
            alt="A bespoke AUREN tailored wool suit jacket on a tailor's mannequin"
            fill
            priority
            sizes="(min-width: 1280px) 1200px, 100vw"
            className="object-cover"
          />
        </div>

        {/* Philosophy & Origin Story */}
        <section className="mx-auto mt-16 max-w-3xl md:mt-24">
          <h2 className="type-h2 font-display text-fg">
            Born from aurum: timeless value over temporary trends
          </h2>
          <div className="mt-6 space-y-5 type-body text-fg-muted">
            <p>
              The name AUREN originates from <em>aurum</em>—the Latin root for gold. In ancient
              antiquity, gold was treasured not for transient flash, but because it never oxidizes,
              never tarnishes, and holds eternal, intrinsic worth.
            </p>
            <p>
              We bring that exact ethos to contemporary menswear. While the global fashion cycle
              churns through synthetic micro-trends every three weeks, AUREN designs deliberate,
              numbered capsule collections meant to remain the cornerstone of your wardrobe for
              years.
            </p>
          </div>
        </section>

        {/* Atelier Craftsmanship Split */}
        <section id="craftsmanship" className="mt-20 border-t border-line pt-16 md:mt-28 md:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-4/3 overflow-hidden rounded-xs border border-line bg-sunken">
              <Image
                src="/editorial/atelier.jpg"
                alt="Master tailor cutting bespoke garment pattern in our atelier"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div>
              <p className="type-eyebrow text-accent-text">The Atelier Standard</p>
              <h2 className="mt-3 type-h1 font-display text-fg">The architecture of fit.</h2>
              <p className="mt-4 type-body text-pretty text-fg-muted">
                Every pattern we draft undergoes dozens of fit iterations. Our tailoring balances
                the relaxed posture required for the warm subtropical climate with the sharp,
                sculpted shoulders expected in high-level boardrooms and evening galas.
              </p>
              <ul className="mt-8 space-y-4">
                <li className="flex items-start gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xs border border-line bg-raised type-small font-mono text-accent-text">
                    01
                  </span>
                  <div>
                    <h3 className="type-h3 font-medium text-fg">
                      Hand-Turned Collars & French Seams
                    </h3>
                    <p className="mt-1 type-small text-fg-muted">
                      Clean inner finishes that eliminate skin irritation and maintain structural
                      crispness after repeated dry cleaning or gentle hand-washing.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xs border border-line bg-raised type-small font-mono text-accent-text">
                    02
                  </span>
                  <div>
                    <h3 className="type-h3 font-medium text-fg">
                      Natural Horn & Troca Shell Buttons
                    </h3>
                    <p className="mt-1 type-small text-fg-muted">
                      No plastic or composite buttons. We source authentic horn and genuine troca
                      pearl shells cross-stitched with reinforced shanks.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-xs border border-line bg-raised type-small font-mono text-accent-text">
                    03
                  </span>
                  <div>
                    <h3 className="type-h3 font-medium text-fg">
                      Fair Living Wages & Ethical Craft
                    </h3>
                    <p className="mt-1 type-small text-fg-muted">
                      Our tailors are salaried master artisans working in humane, air-conditioned
                      studios with comprehensive healthcare and benefits.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Natural Fiber Standards */}
        <section id="fabrics" className="mt-20 border-t border-line pt-16 md:mt-28 md:pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="type-eyebrow text-accent-text">Materials</p>
            <h2 className="mt-3 type-h1 font-display text-fg">Noble, unblended natural fibers</h2>
            <p className="mt-4 type-body text-pretty text-fg-muted">
              We never use synthetic polyester blends in our core tailoring. We select exclusively
              traceable, premium raw materials.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border border-line bg-raised/30 p-8">
              <span className="type-small font-mono text-accent-text">COTTON</span>
              <h3 className="mt-2 type-h3 font-display text-fg">Long-Staple Egyptian Giza 87</h3>
              <p className="mt-3 type-small text-fg-muted">
                Renowned worldwide for extreme fiber length and silky luster. Exceptionally soft on
                the skin with high tensile durability.
              </p>
            </div>
            <div className="border border-line bg-raised/30 p-8">
              <span className="type-small font-mono text-accent-text">LINEN</span>
              <h3 className="mt-2 type-h3 font-display text-fg">Normandy Flax European Linen</h3>
              <p className="mt-3 type-small text-fg-muted">
                Woven from French and Belgian flax fields. Naturally thermo-regulating, cooling, and
                gains beautiful drape with every gentle wash.
              </p>
            </div>
            <div className="border border-line bg-raised/30 p-8">
              <span className="type-small font-mono text-accent-text">WOOL</span>
              <h3 className="mt-2 type-h3 font-display text-fg">Super 120s & 130s Merino Wool</h3>
              <p className="mt-3 type-small text-fg-muted">
                Tropical-weight worsted merino wool that naturally resists wrinkles and breathes
                effortlessly during Dhaka summers and overseas travel.
              </p>
            </div>
          </div>
        </section>

        {/* Invitation to Shop */}
        <section className="mt-20 border border-line bg-raised/60 p-10 text-center md:mt-28 md:p-16">
          <h2 className="type-h2 font-display text-fg">Experience the Collection</h2>
          <p className="mx-auto mt-4 max-w-lg type-body text-fg-muted">
            Discover modern tailoring and elevated essentials crafted for the discerning wardrobe.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/shop">Shop all pieces</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/contact">Speak with our concierge</Link>
            </Button>
          </div>
        </section>
      </div>
    </article>
  );
}
