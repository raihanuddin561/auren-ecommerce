import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
};

async function SearchBody({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? '';

  return (
    <>
      <form action="/search" method="get" role="search" className="mt-8 flex max-w-xl gap-3">
        <label htmlFor="search-q" className="sr-only">
          Search AUREN
        </label>
        <Input
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search shirts, trousers, knitwear"
          autoComplete="off"
          maxLength={100}
        />
        <Button type="submit" size="md">
          Search
        </Button>
      </form>
      <p className="mt-8 max-w-xl type-body text-fg-muted">
        {q
          ? `Search is on its way, so there are no results for "${q}" yet. In the meantime, browse the shop.`
          : 'Search is on its way. In the meantime, browse the shop.'}
      </p>
      <div className="mt-6">
        <Button asChild variant="link">
          <Link href="/shop">Shop all</Link>
        </Button>
      </div>
    </>
  );
}

/** Stand-in until real search arrives: a plain GET form and a calm note. */
export default function SearchPage(props: PageProps<'/search'>) {
  return (
    <section className="container-editorial py-16 md:py-24">
      <p className="type-eyebrow text-accent-text">Search</p>
      <h1 className="mt-3 type-h1 text-fg">What are you looking for?</h1>
      <Suspense fallback={<div className="mt-8 h-12 max-w-xl animate-skeleton bg-skeleton" />}>
        <SearchBody searchParams={props.searchParams} />
      </Suspense>
    </section>
  );
}
