import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CollectionForm } from '@/components/admin/catalog/collections/collection-form';
import { CollectionHero } from '@/components/admin/catalog/collections/collection-hero';
import { DeleteCollection } from '@/components/admin/catalog/collections/delete-collection';
import {
  isoToLocalInput,
  type CollectionFormValues,
} from '@/components/admin/catalog/collections/form-state';
import { MembersPanel } from '@/components/admin/catalog/collections/members-panel';
import { FormSection } from '@/components/admin/form-section';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { hasPermission } from '@/lib/permissions';
import { requireStaffWith } from '@/lib/staff';
import { getCollectionForAdmin, listCategoryOptions } from '@/modules/catalog/queries';

export const metadata: Metadata = {
  title: 'Edit collection',
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffWith('catalog.read');
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [collection, categories] = await Promise.all([
    getCollectionForAdmin(id),
    listCategoryOptions(),
  ]);
  if (!collection) notFound();

  const canWrite = hasPermission(staff, 'catalog.write');
  const canPublish = hasPermission(staff, 'catalog.publish');
  const publishedAt = collection.publishedAt ? collection.publishedAt.toISOString() : null;

  const initial: CollectionFormValues = {
    title: collection.title,
    slug: collection.slug,
    description: collection.description ?? '',
    type: collection.type,
    rules: collection.rules,
    sortOrder: collection.sortOrder,
    isFeatured: collection.isFeatured,
    seoTitle: collection.seoTitle ?? '',
    seoDescription: collection.seoDescription ?? '',
    publishMode: publishedAt ? 'keep' : 'draft',
    scheduledAt: publishedAt ? isoToLocalInput(publishedAt) : '',
  };

  return (
    <>
      <PageHeader
        title={collection.title}
        breadcrumb={[
          { label: 'Collections', href: '/admin/collections' },
          { label: collection.title },
        ]}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone="outline">{collection.type === 'automatic' ? 'Automatic' : 'Manual'}</Badge>
            <Badge
              tone={
                collection.state === 'live'
                  ? 'success'
                  : collection.state === 'scheduled'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {collection.state === 'live'
                ? 'Live'
                : collection.state === 'scheduled'
                  ? 'Scheduled'
                  : 'Draft'}
            </Badge>
          </span>
        }
        actions={
          canPublish ? (
            <DeleteCollection
              collectionId={collection.id}
              title={collection.title}
              isLive={collection.state === 'live'}
            />
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        <CollectionForm
          collectionId={collection.id}
          initial={initial}
          savedPublishedAt={publishedAt}
          savedState={collection.state}
          categories={categories.map((c) => ({ id: c.id, label: c.label }))}
          canWrite={canWrite}
          canPublish={canPublish}
        />

        <FormSection
          title="Members"
          description={
            collection.type === 'automatic'
              ? 'Products that match the saved rules.'
              : 'The products in this collection, in the order shoppers see them.'
          }
        >
          <MembersPanel
            collectionId={collection.id}
            type={collection.type}
            canWrite={canWrite}
            members={collection.members}
          />
        </FormSection>

        <FormSection
          title="Hero image"
          description="Shown at the top of the collection page and on the home page."
        >
          {canWrite ? (
            <CollectionHero collectionId={collection.id} current={collection.hero} />
          ) : collection.hero ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an optimised upload
            <img
              src={collection.hero.url}
              alt={collection.hero.alt}
              className="aspect-[4/5] w-40 border border-line object-cover"
            />
          ) : (
            <p className="type-admin text-fg-muted">No hero image.</p>
          )}
        </FormSection>
      </div>
    </>
  );
}
