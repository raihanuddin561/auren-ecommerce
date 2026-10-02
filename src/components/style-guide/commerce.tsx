import { FilterChipDemo } from './filter-chip-demo';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Pagination } from '@/components/ui/pagination';
import { Price, PriceSkeleton } from '@/components/ui/price';
import { Rating, RatingSkeleton } from '@/components/ui/rating';
import { money } from '@/lib/money';
import { GuideGroup, GuideSection, Specimen } from './guide-section';

const bdt = (minor: number) => money(BigInt(minor), 'BDT');

export function CommerceSection() {
  return (
    <GuideSection
      id="commerce"
      title="Price, rating and navigation"
      description="Money always goes through lib/money. Ratings are read aloud as words. Pagination is made of real links."
    >
      <GuideGroup label="Price">
        <Specimen label="Regular">
          <Price price={bdt(129900)} />
        </Specimen>
        <Specimen label="Reduced (compare-at struck through)">
          <Price price={bdt(99900)} compareAt={bdt(129900)} />
        </Specimen>
        <Specimen label="Large">
          <Price price={bdt(1245000)} size="lg" />
        </Specimen>
        <Specimen label="Small">
          <Price price={bdt(49900)} size="sm" />
        </Specimen>
        <Specimen label="Loading">
          <PriceSkeleton />
        </Specimen>
      </GuideGroup>

      <GuideGroup label="Rating">
        <Specimen label="4.5 from 128 reviews">
          <Rating value={4.5} count={128} />
        </Specimen>
        <Specimen label="3.2">
          <Rating value={3.2} count={9} />
        </Specimen>
        <Specimen label="No reviews yet">
          <Rating value={0} count={0} />
        </Specimen>
        <Specimen label="Loading">
          <RatingSkeleton />
        </Specimen>
      </GuideGroup>

      <GuideGroup label="Breadcrumb" className="block">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Shirts', href: '/shop/shirts' },
            { label: 'Oxford shirt in Egyptian cotton' },
          ]}
        />
      </GuideGroup>

      <GuideGroup label="Pagination" className="block">
        <Pagination
          page={4}
          totalPages={12}
          hrefFor={(page) => `/admin/style-guide?page=${page}`}
        />
      </GuideGroup>

      <GuideGroup label="Filter chips (the only pill in the system)">
        <FilterChipDemo />
      </GuideGroup>
    </GuideSection>
  );
}
