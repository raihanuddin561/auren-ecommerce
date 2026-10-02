import { ImageFrame } from '@/components/motion/image-frame';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/cn';
import { GuideGroup, GuideSection, Specimen } from './guide-section';

const BRAND_SWATCHES = [
  {
    token: 'ink',
    hex: '#0F0F0F',
    className: 'bg-ink',
    use: 'Text, primary buttons, dark sections',
  },
  { token: 'ink-soft', hex: '#2A2A2A', className: 'bg-ink-soft', use: 'Secondary dark surfaces' },
  { token: 'ivory', hex: '#F6F2EB', className: 'bg-ivory', use: 'Page background' },
  { token: 'paper', hex: '#FFFFFF', className: 'bg-paper', use: 'Cards, drawers, inputs' },
  {
    token: 'gold',
    hex: '#A8875A',
    className: 'bg-gold',
    use: 'Accent only: focus, underline, badges',
  },
  {
    token: 'gold-soft',
    hex: '#D9C7A6',
    className: 'bg-gold-soft',
    use: 'Hover tints, dividers on dark',
  },
  {
    token: 'gold-strong',
    hex: '#7A5F38',
    className: 'bg-gold-strong',
    use: 'Small accent text on light',
  },
  { token: 'oxblood', hex: '#5A1F24', className: 'bg-oxblood', use: 'Limited drops, sale' },
  { token: 'success', hex: '#3F6B4E', className: 'bg-success', use: 'Positive states' },
  { token: 'warning', hex: '#9A6B1F', className: 'bg-warning', use: 'Low stock' },
  { token: 'danger', hex: '#9B2C2C', className: 'bg-danger', use: 'Errors' },
] as const;

const STONE = [
  ['100', 'bg-stone-100'],
  ['200', 'bg-stone-200'],
  ['300', 'bg-stone-300'],
  ['400', 'bg-stone-400'],
  ['500', 'bg-stone-500'],
  ['600', 'bg-stone-600'],
  ['700', 'bg-stone-700'],
  ['800', 'bg-stone-800'],
  ['900', 'bg-stone-900'],
] as const;

export function ColourSection() {
  return (
    <GuideSection
      id="colour"
      title="Colour"
      description="Light-first with dark editorial sections. Gold is an accent and never a large fill or body text."
    >
      <GuideGroup label="Brand" className="gap-x-6 gap-y-6">
        {BRAND_SWATCHES.map((swatch) => (
          <div key={swatch.token} className="w-40">
            <div className={cn('h-20 border border-line', swatch.className)} />
            <p className="mt-2 type-admin font-medium text-fg">{swatch.token}</p>
            <p className="type-small text-fg-muted tabular-nums">{swatch.hex}</p>
            <p className="type-small text-fg-muted">{swatch.use}</p>
          </div>
        ))}
      </GuideGroup>

      <GuideGroup label="Stone (warm neutrals)">
        <div className="flex w-full max-w-3xl">
          {STONE.map(([step, className]) => (
            <div key={step} className="flex-1">
              <div className={cn('h-14', className)} />
              <p className="mt-2 type-small text-fg-muted tabular-nums">{step}</p>
            </div>
          ))}
        </div>
      </GuideGroup>

      <GuideGroup label="Text on surfaces (WCAG AA verified by tests)">
        <div className="bg-page p-6 text-fg ring-1 ring-line">
          <p className="type-body">Ink on ivory</p>
          <p className="type-body text-fg-muted">Muted on ivory</p>
          <p className="type-body text-accent-text">Accent on ivory</p>
        </div>
        <div className="bg-raised p-6 text-fg ring-1 ring-line">
          <p className="type-body">Ink on paper</p>
          <p className="type-body text-danger-text">Danger on paper</p>
          <p className="type-body text-success-text">Success on paper</p>
          <p className="type-body text-warning-text">Warning on paper</p>
        </div>
        <div data-tone="ink" className="bg-page p-6 text-fg">
          <p className="type-body">Ivory on ink</p>
          <p className="type-body text-fg-muted">Muted on ink</p>
          <p className="type-body text-accent-text">Gold on ink</p>
        </div>
      </GuideGroup>
    </GuideSection>
  );
}

export function TypographySection() {
  return (
    <GuideSection
      id="typography"
      title="Typography"
      description="Cormorant Garamond for display and headings, Manrope for interface and body. Prices use tabular numerals."
    >
      <div className="flex flex-col gap-8">
        <Specimen label="display-xl · 44 to 96px · serif light">
          <p className="type-display-xl">Quiet confidence</p>
        </Specimen>
        <Specimen label="display-lg · 36 to 64px">
          <p className="type-display-lg">Crafted in Egyptian cotton</p>
        </Specimen>
        <Specimen label="h1 · 30 to 44px · serif">
          <p className="type-h1">Tailored for the long day</p>
        </Specimen>
        <Specimen label="h2 · 24 to 32px · serif">
          <p className="type-h2">The essentials edit</p>
        </Specimen>
        <Specimen label="h3 · 18 to 22px · sans medium">
          <p className="type-h3">Details and fit</p>
        </Specimen>
        <Specimen label="body · 15 to 16px · line height 1.65">
          <p className="max-w-prose type-body">
            Woven from long-staple cotton, this shirt is cut with a softly structured collar and a
            clean placket. It is made to be worn often and to look better with every wash.
          </p>
        </Specimen>
        <Specimen label="small · 13px · meta">
          <p className="type-small">Model is 183 cm and wears size M.</p>
        </Specimen>
        <Specimen label="eyebrow · 11 to 12px · uppercase · 0.18em">
          <p className="type-eyebrow">New arrivals</p>
        </Specimen>
        <Specimen label="admin · 14px">
          <p className="type-admin">Orders waiting for confirmation</p>
        </Specimen>
        <Specimen label="wordmark · 0.32em tracking">
          <p className="type-wordmark text-h1">AUREN</p>
        </Specimen>
        <Specimen label="tabular numerals for prices">
          <p className="type-price text-h3">৳1,299 · ৳12,450 · ৳999</p>
        </Specimen>
      </div>
    </GuideSection>
  );
}

export function ShapeSection() {
  return (
    <GuideSection
      id="shape"
      title="Space, shape and imagery"
      description="Sharp 0 to 2px radii, borders over shadows, one soft shadow for floating layers, and 4:5 product imagery everywhere."
    >
      <GuideGroup label="Radius and elevation">
        <Specimen label="radius 0">
          <div className="size-24 border border-line-strong bg-raised" />
        </Specimen>
        <Specimen label="radius 2px (sm, md, lg)">
          <div className="size-24 rounded-sm border border-line-strong bg-raised" />
        </Specimen>
        <Specimen label="shadow-float (drawers, popovers)">
          <div className="size-24 rounded-sm bg-raised shadow-float" />
        </Specimen>
        <Specimen label="pill: filter chips only">
          <div className="flex h-10 w-24 items-center justify-center rounded-full border border-line-strong type-small">
            Pill
          </div>
        </Specimen>
      </GuideGroup>

      <GuideGroup label="Product image frames (4:5)">
        <div className="w-44">
          <ImageFrame src="/seed/sand.svg" alt="Sand coloured product" sizes="176px" />
          <p className="mt-2 type-small text-fg-muted">Plain</p>
        </div>
        <div className="w-44">
          <ImageFrame
            src="/seed/charcoal.svg"
            alt="Charcoal coloured product"
            sizes="176px"
            hoverSrc="/seed/ivory.svg"
            hoverAlt="Ivory alternate view"
          />
          <p className="mt-2 type-small text-fg-muted">Hover swaps to a second image</p>
        </div>
        <div className="w-44">
          <ImageFrame src="/seed/navy.svg" alt="Navy coloured product" sizes="176px" zoom />
          <p className="mt-2 type-small text-fg-muted">Hover zooms to 1.04</p>
        </div>
      </GuideGroup>

      <GuideGroup label="Layout">
        <div className="w-full max-w-3xl border border-dashed border-line-strong p-4">
          <p className="type-small text-fg-muted">
            Container 1440px, editorial measure 720px, gutters 20px on mobile and 40px from tablet
            up, section rhythm 80px on mobile and 128px from tablet up.
          </p>
        </div>
      </GuideGroup>
    </GuideSection>
  );
}

export function MotionSection() {
  return (
    <GuideSection
      id="motion"
      title="Motion"
      description="Soft ease-out, 150 to 800 ms, reveal once. Everything collapses to instant changes when the visitor prefers reduced motion."
    >
      <GuideGroup label="Duration tokens">
        {[
          ['fast', '150 ms'],
          ['base', '250 ms'],
          ['slow', '450 ms'],
          ['reveal', '800 ms'],
        ].map(([name, value]) => (
          <div key={name} className="w-32 border border-line bg-raised p-4">
            <p className="type-admin font-medium text-fg">{name}</p>
            <p className="type-small text-fg-muted tabular-nums">{value}</p>
          </div>
        ))}
        <div className="border border-line bg-raised p-4">
          <p className="type-admin font-medium text-fg">ease-auren</p>
          <p className="type-small text-fg-muted tabular-nums">cubic-bezier(0.22, 1, 0.36, 1)</p>
        </div>
      </GuideGroup>

      <GuideGroup label="Reveal on scroll (fades and rises once)">
        <Reveal className="w-64 border border-line bg-raised p-5">
          <p className="type-admin font-medium text-fg">Revealed content</p>
          <p className="type-small text-fg-muted">
            Visible without JavaScript, and when the preference is reduced motion.
          </p>
        </Reveal>
      </GuideGroup>
    </GuideSection>
  );
}
