import { AdminPartsSection } from './admin-parts';
import { CommerceSection } from './commerce';
import { ButtonsSection, FormsSection } from './controls';
import { FeedbackSection } from './feedback';
import { ColourSection, MotionSection, ShapeSection, TypographySection } from './foundations';
import { OverlaysSection } from './overlays';
import { StorefrontPartsSection } from './storefront-parts';

export const STYLE_GUIDE_SECTIONS = [
  ['colour', 'Colour'],
  ['typography', 'Typography'],
  ['shape', 'Shape and imagery'],
  ['motion', 'Motion'],
  ['buttons', 'Buttons'],
  ['forms', 'Form controls'],
  ['overlays', 'Overlays'],
  ['feedback', 'Feedback'],
  ['commerce', 'Price and rating'],
  ['storefront', 'Storefront'],
  ['admin', 'Admin console'],
] as const;

/** Every component and state in the design system, in one place for review and visual snapshots. */
export function StyleGuide() {
  return (
    <div>
      <nav aria-label="Style guide sections" className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
        {STYLE_GUIDE_SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-8 items-center type-admin text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            {label}
          </a>
        ))}
      </nav>
      <ColourSection />
      <TypographySection />
      <ShapeSection />
      <MotionSection />
      <ButtonsSection />
      <FormsSection />
      <OverlaysSection />
      <FeedbackSection />
      <CommerceSection />
      <StorefrontPartsSection />
      <AdminPartsSection />
    </div>
  );
}
