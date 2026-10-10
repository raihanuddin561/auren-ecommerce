import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { draftMode } from 'next/headers';
import { Suspense } from 'react';
import { getDraftPageBySlug, getPublishedPageBySlug } from '@/modules/content/queries';
import { SectionRenderer } from '@/components/content/section-renderer';
import { buildPageMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const page = await getPublishedPageBySlug(slug);

    if (!page) {
      return {
        title: 'Page Not Found',
        robots: { index: false, follow: false },
      };
    }

    return buildPageMetadata({
      title: page.seoTitle || page.title,
      description: page.seoDescription || page.description || undefined,
      path: `/pages/${page.slug}`,
      image: page.ogImageUrl || undefined,
    });
  } catch {
    return {
      title: 'Page Not Found',
      robots: { index: false, follow: false },
    };
  }
}

async function PageContent({ params }: PageProps) {
  const { slug } = await params;
  const { isEnabled: isDraft } = await draftMode();

  let page = null;
  try {
    page = isDraft ? await getDraftPageBySlug(slug) : await getPublishedPageBySlug(slug);
  } catch {
    notFound();
  }

  if (!page) {
    notFound();
  }

  return (
    <article className="min-h-screen py-10 md:py-16">
      {isDraft && (
        <aside
          aria-label="Draft mode banner"
          className="text-canvas shadow-md fixed top-20 right-6 z-50 rounded-sm border border-gold bg-ink px-3.5 py-1.5 font-mono text-xs"
        >
          Draft Preview Mode Active
        </aside>
      )}

      <header className="mx-auto mb-12 max-w-4xl space-y-3 px-6 text-center">
        <h1 className="font-serif text-3xl font-light tracking-tight text-ink md:text-5xl">
          {page.title}
        </h1>
        {page.description && (
          <p className="text-stone mx-auto max-w-xl text-xs leading-relaxed md:text-sm">
            {page.description}
          </p>
        )}
      </header>

      <SectionRenderer sections={page.sections} />
    </article>
  );
}

function PageSkeleton() {
  return (
    <article className="min-h-screen py-10 md:py-16">
      <header className="mx-auto mb-12 max-w-4xl space-y-3 px-6 text-center">
        <div className="mx-auto h-10 w-3/4 max-w-md animate-skeleton rounded-xs bg-skeleton md:h-14" />
        <div className="mx-auto h-4 w-1/2 max-w-sm animate-skeleton rounded-xs bg-skeleton" />
      </header>
      <div className="container-page space-y-12">
        <div className="h-64 w-full animate-skeleton rounded-xs bg-skeleton" />
      </div>
    </article>
  );
}

export default function StorefrontContentPage(props: PageProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PageContent {...props} />
    </Suspense>
  );
}
