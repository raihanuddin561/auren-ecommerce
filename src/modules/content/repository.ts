import type { Tx } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type {
  CreatePageInput,
  CreatePageSectionInput,
  PageFilterInput,
  UpdatePageInput,
  UpdatePageSectionInput,
} from './schemas';

export async function listPages(tx: Tx, params: PageFilterInput) {
  const where: Prisma.PageWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: 'insensitive' } },
            { slug: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, totalCount] = await Promise.all([
    tx.page.findMany({
      where,
      take: params.limit ?? 25,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        _count: {
          select: { sections: true },
        },
      },
    }),
    tx.page.count({ where }),
  ]);

  return { items, totalCount };
}

export async function getPageById(tx: Tx, id: string) {
  return tx.page.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

export async function getPageBySlug(tx: Tx, slug: string, includeUnpublished = false) {
  const page = await tx.page.findUnique({
    where: { slug },
    include: {
      sections: {
        where: includeUnpublished
          ? undefined
          : {
              isVisible: true,
              OR: [
                { startsAt: null, endsAt: null },
                { startsAt: { lte: new Date() }, endsAt: null },
                { startsAt: null, endsAt: { gte: new Date() } },
                { startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
              ],
            },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!page) return null;
  if (!includeUnpublished && page.status !== 'published') {
    return null;
  }

  return page;
}

export async function createPage(tx: Tx, input: CreatePageInput, authorId?: string | null) {
  return tx.page.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description,
      status: input.status,
      publishedAt: input.status === 'published' ? new Date() : null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      ogImageUrl: input.ogImageUrl,
      createdBy: authorId,
      updatedBy: authorId,
    },
  });
}

export async function updatePage(tx: Tx, input: UpdatePageInput, authorId?: string | null) {
  const current = await tx.page.findUniqueOrThrow({ where: { id: input.id } });

  const isPublishing = input.status === 'published' && current.status !== 'published';
  const publishedAt = isPublishing
    ? new Date()
    : input.status
      ? input.status === 'published'
        ? current.publishedAt
        : null
      : undefined;

  return tx.page.update({
    where: { id: input.id },
    data: {
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      ...(input.scheduledAt !== undefined
        ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
        : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
      ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
      ...(input.ogImageUrl !== undefined ? { ogImageUrl: input.ogImageUrl } : {}),
      updatedBy: authorId,
    },
  });
}

export async function deletePage(tx: Tx, id: string) {
  return tx.page.delete({ where: { id } });
}

export async function createPageSection(tx: Tx, input: CreatePageSectionInput) {
  let sortOrder = input.sortOrder;
  if (!sortOrder) {
    const lastSection = await tx.pageSection.findFirst({
      where: { pageId: input.pageId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = (lastSection?.sortOrder ?? -1) + 1;
  }

  return tx.pageSection.create({
    data: {
      pageId: input.pageId,
      blockType: input.blockType,
      name: input.name,
      props: input.props as Prisma.InputJsonValue,
      sortOrder,
      isVisible: input.isVisible ?? true,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    },
  });
}

export async function updatePageSection(tx: Tx, input: UpdatePageSectionInput) {
  return tx.pageSection.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.props !== undefined ? { props: input.props as Prisma.InputJsonValue } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
        : {}),
      ...(input.endsAt !== undefined
        ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
        : {}),
    },
  });
}

export async function deletePageSection(tx: Tx, id: string) {
  return tx.pageSection.delete({ where: { id } });
}

export async function reorderSections(tx: Tx, pageId: string, orderedSectionIds: string[]) {
  await Promise.all(
    orderedSectionIds.map((id, index) =>
      tx.pageSection.updateMany({
        where: { id, pageId },
        data: { sortOrder: index },
      }),
    ),
  );
}
