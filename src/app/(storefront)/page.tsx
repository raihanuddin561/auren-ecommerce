import type { Metadata } from 'next';
import Link from 'next/link';
import { ImageFrame } from '@/components/motion/image-frame';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: { absolute: 'AUREN | Modern, refined menswear' },
  alternates: { canonical: '/' },
};

/** Placeholder landing page: one ink hero until the campaign blocks arrive. */
export default function HomePage() {
  return (
    <section
      data-tone="ink"
      className="relative flex min-h-svh flex-1 items-end bg-page pt-(--header-height) text-fg"
    >
      <div className="container-page grid items-end gap-12 pb-16 md:grid-cols-12 md:pb-24">
        <Reveal className="md:col-span-7">
          <p className="type-eyebrow text-accent-text">AUREN</p>
          <h1 className="mt-5 max-w-4xl type-display-xl text-fg">Modern, refined menswear</h1>
          <p className="mt-6 max-w-xl type-body text-pretty text-fg-muted">
            Elevated essentials and tailoring, crafted in breathable fabrics and made to be worn for
            years.
          </p>
          <div className="mt-10">
            <Button asChild variant="primary" size="lg">
              <Link href="/shop">Explore the collection</Link>
            </Button>
          </div>
        </Reveal>
        {/* Stand-in for campaign photography; decorative, so no alt text. */}
        <div className="hidden md:col-span-4 md:col-start-9 md:block">
          <ImageFrame src="/seed/charcoal.svg" alt="" sizes="30vw" priority />
        </div>
      </div>
    </section>
  );
}
