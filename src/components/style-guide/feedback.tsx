import { PackageOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { GuideGroup, GuideSection, Specimen } from './guide-section';

export function FeedbackSection() {
  return (
    <GuideSection
      id="feedback"
      title="Feedback and states"
      description="Skeletons match the final layout so nothing shifts. Empty and error states always offer a way forward."
    >
      <GuideGroup label="Badges">
        <Badge>New</Badge>
        <Badge tone="outline">Low stock</Badge>
        <Badge tone="ink">Bestseller</Badge>
        <Badge tone="gold">Limited</Badge>
        <Badge tone="oxblood">Sale</Badge>
        <Badge tone="success">Paid</Badge>
        <Badge tone="warning">Needs a call</Badge>
        <Badge tone="danger">Payment failed</Badge>
      </GuideGroup>

      <GuideGroup label="Loading">
        <Specimen label="Skeleton card (4:5 image, title, price)">
          <SkeletonRegion label="Loading product" className="w-44">
            <Skeleton className="aspect-4/5 w-full" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </SkeletonRegion>
        </Specimen>
        <Specimen label="Skeleton text">
          <SkeletonText lines={3} className="w-64" />
        </Specimen>
        <Specimen label="Spinner (rare)">
          <Spinner label="Loading" className="size-6" />
        </Specimen>
      </GuideGroup>

      <GuideGroup label="Empty and error" className="grid gap-6 md:grid-cols-2">
        <EmptyState
          icon={<Icon icon={PackageOpen} size={28} />}
          title="No pieces match these filters"
          description="Try removing a filter, or explore the bestsellers."
          action={
            <>
              <Button variant="secondary" size="sm">
                Clear filters
              </Button>
              <Button variant="link">View bestsellers</Button>
            </>
          }
        />
        <EmptyState
          tone="error"
          title="Payment didn't go through"
          description="Your bag is saved. Try again or choose Cash on Delivery."
          action={<Button size="sm">Try again</Button>}
        />
      </GuideGroup>
    </GuideSection>
  );
}
