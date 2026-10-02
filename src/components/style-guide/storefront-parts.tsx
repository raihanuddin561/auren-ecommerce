import { Button } from '@/components/ui/button';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { NewsletterForm } from '@/components/storefront/newsletter-form';
import { Wordmark } from '@/components/storefront/wordmark';
import { ANNOUNCEMENTS } from '@/lib/site';
import { GuideGroup, GuideSection, Specimen } from './guide-section';

export function StorefrontPartsSection() {
  return (
    <GuideSection
      id="storefront"
      title="Storefront pieces"
      description="The wordmark, announcement bar, newsletter form and a dark editorial section. The header, menus and footer are on every storefront page."
    >
      <GuideGroup label="Wordmark">
        <Specimen label="Link">
          <Wordmark />
        </Specimen>
        <Specimen label="Plain text">
          <Wordmark asText className="text-h1" />
        </Specimen>
      </GuideGroup>

      <GuideGroup label="Announcement bar" className="block">
        <AnnouncementBar messages={ANNOUNCEMENTS} />
      </GuideGroup>

      <GuideGroup label="Newsletter form" className="block">
        <div className="max-w-md">
          <NewsletterForm />
        </div>
      </GuideGroup>

      <GuideGroup label="Dark editorial section" className="block">
        <div data-tone="ink" className="bg-page px-8 py-14 text-fg">
          <p className="type-eyebrow text-accent-text">Craftsmanship</p>
          <p className="mt-3 max-w-xl type-h1">Cut with care, finished by hand</p>
          <p className="mt-4 max-w-md type-body text-fg-muted">
            Every seam is pressed and every button sewn on with a shank, so the garment keeps its
            shape through years of wear.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button>Discover the craft</Button>
            <Button variant="secondary">Read the journal</Button>
          </div>
        </div>
      </GuideGroup>
    </GuideSection>
  );
}
