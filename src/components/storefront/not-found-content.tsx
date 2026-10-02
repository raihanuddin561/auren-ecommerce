import { Search } from 'lucide-react';
import Link from 'next/link';
import { ImageFrame } from '@/components/motion/image-frame';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

/** Editorial 404: calm, helpful, with a way to search and somewhere good to go next. */
export function NotFoundContent() {
  return (
    <section className="container-page grid flex-1 items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24">
      <div className="mx-auto w-full max-w-sm md:order-2 md:max-w-md">
        <ImageFrame
          src="/seed/stone.svg"
          alt="A folded stone coloured garment"
          sizes="(min-width: 768px) 448px, 384px"
          priority
        />
      </div>

      <div className="md:order-1">
        <p className="type-eyebrow text-accent-text">Error 404</p>
        <h1 className="mt-4 type-display-lg text-fg">This page has stepped out</h1>
        <p className="mt-5 max-w-md type-body text-fg-muted">
          The page you were looking for has moved or no longer exists. Search the collection, or
          start again from the shop.
        </p>

        <form action="/search" method="get" role="search" className="mt-8 flex max-w-md gap-3">
          <FormField label="Search the collection" hideLabel className="flex-1">
            {(control) => (
              <Input {...control} name="q" type="search" placeholder="Search the collection" />
            )}
          </FormField>
          <Button type="submit" size="md" aria-label="Search">
            <Icon icon={Search} size={18} />
          </Button>
        </form>

        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2">
          <Button asChild variant="link">
            <Link href="/shop">Shop all</Link>
          </Button>
          <Button asChild variant="link">
            <Link href="/collections/bestsellers">Bestsellers</Link>
          </Button>
          <Button asChild variant="link">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
