import { revalidateTag } from 'next/cache';
import { db, type Tx } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';
import {
  validateBlockProps,
  type CreatePageInput,
  type CreatePageSectionInput,
  type PageFilterInput,
  type ReorderPageSectionsInput,
  type UpdatePageInput,
  type UpdatePageSectionInput,
} from './schemas';
import type { PageDetail, PageListItem, PageSectionItem } from './types';

// =============================================================================================
// Pages Service
// =============================================================================================

export async function listPages(
  params: PageFilterInput,
  tx: Tx = db,
): Promise<{ items: PageListItem[]; totalCount: number }> {
  const result = await repo.listPages(tx, params);

  const items: PageListItem[] = result.items.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    status: p.status,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    sectionsCount: p._count.sections,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return { items, totalCount: result.totalCount };
}

export async function getPageById(id: string, tx: Tx = db): Promise<PageDetail | null> {
  const p = await repo.getPageById(tx, id);
  if (!p) return null;

  return mapPageDetail(p);
}

export async function getPageBySlug(
  slug: string,
  includeUnpublished = false,
  tx: Tx = db,
): Promise<PageDetail | null> {
  const p = await repo.getPageBySlug(tx, slug, includeUnpublished);
  if (!p) return null;

  return mapPageDetail(p);
}

export async function createPage(
  input: CreatePageInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<string> {
  return db.$transaction(async (tx) => {
    const existing = await repo.getPageBySlug(tx, input.slug, true);
    if (existing) {
      throw new DomainError('CONFLICT', `A page with slug "${input.slug}" already exists`);
    }

    const created = await repo.createPage(tx, input, actor.userId);

    await audit(tx, {
      actorId: actor.userId,
      action: 'page.create',
      entity: 'page',
      entityId: created.id,
      after: { slug: created.slug, title: created.title, status: created.status },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    revalidateTag('pages', 'max');
    return created.id;
  });
}

export async function updatePage(
  input: UpdatePageInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await repo.getPageById(tx, input.id);
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Page not found');
    }

    if (input.slug && input.slug !== current.slug) {
      const existing = await repo.getPageBySlug(tx, input.slug, true);
      if (existing && existing.id !== input.id) {
        throw new DomainError('CONFLICT', `A page with slug "${input.slug}" already exists`);
      }
    }

    const updated = await repo.updatePage(tx, input, actor.userId);

    await audit(tx, {
      actorId: actor.userId,
      action:
        input.status && input.status !== current.status
          ? `page.status.${input.status}`
          : 'page.update',
      entity: 'page',
      entityId: updated.id,
      before: { slug: current.slug, title: current.title, status: current.status },
      after: { slug: updated.slug, title: updated.title, status: updated.status },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    revalidateTag(`page:${current.slug}`, 'max');
    if (updated.slug !== current.slug) {
      revalidateTag(`page:${updated.slug}`, 'max');
    }
    revalidateTag('pages', 'max');
  });
}

export async function deletePage(
  id: string,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await repo.getPageById(tx, id);
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Page not found');
    }

    await repo.deletePage(tx, id);

    await audit(tx, {
      actorId: actor.userId,
      action: 'page.delete',
      entity: 'page',
      entityId: id,
      before: { slug: current.slug, title: current.title },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    revalidateTag(`page:${current.slug}`, 'max');
    revalidateTag('pages', 'max');
  });
}

// =============================================================================================
// Page Sections Service
// =============================================================================================

export async function createPageSection(
  input: CreatePageSectionInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<string> {
  const propValidation = validateBlockProps(input.blockType, input.props);
  if (!propValidation.success) {
    throw new DomainError(
      'VALIDATION',
      `Invalid props for ${input.blockType}: ${propValidation.error.issues[0]?.message}`,
    );
  }

  return db.$transaction(async (tx) => {
    const page = await repo.getPageById(tx, input.pageId);
    if (!page) {
      throw new DomainError('NOT_FOUND', 'Page not found');
    }

    const created = await repo.createPageSection(tx, {
      ...input,
      props: propValidation.data as Record<string, unknown>,
    });

    await audit(tx, {
      actorId: actor.userId,
      action: 'page_section.create',
      entity: 'page_section',
      entityId: created.id,
      after: { pageId: page.id, blockType: created.blockType, sortOrder: created.sortOrder },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    revalidateTag(`page:${page.slug}`, 'max');
    return created.id;
  });
}

export async function updatePageSection(
  input: UpdatePageSectionInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const section = await tx.pageSection.findUnique({
      where: { id: input.id },
      include: { page: true },
    });
    if (!section) {
      throw new DomainError('NOT_FOUND', 'Section not found');
    }

    let validatedProps = input.props;
    if (input.props !== undefined) {
      const propValidation = validateBlockProps(section.blockType, input.props);
      if (!propValidation.success) {
        throw new DomainError(
          'VALIDATION',
          `Invalid props for ${section.blockType}: ${propValidation.error.issues[0]?.message}`,
        );
      }
      validatedProps = propValidation.data as Record<string, unknown>;
    }

    const updated = await repo.updatePageSection(tx, {
      ...input,
      props: validatedProps,
    });

    await audit(tx, {
      actorId: actor.userId,
      action: 'page_section.update',
      entity: 'page_section',
      entityId: updated.id,
      after: { pageId: section.pageId, blockType: updated.blockType },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    revalidateTag(`page:${section.page.slug}`, 'max');
  });
}

export async function deletePageSection(
  id: string,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const section = await tx.pageSection.findUnique({
      where: { id },
      include: { page: true },
    });
    if (!section) {
      throw new DomainError('NOT_FOUND', 'Section not found');
    }

    await repo.deletePageSection(tx, id);

    await audit(tx, {
      actorId: actor.userId,
      action: 'page_section.delete',
      entity: 'page_section',
      entityId: id,
      before: { pageId: section.pageId, blockType: section.blockType },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    revalidateTag(`page:${section.page.slug}`, 'max');
  });
}

export async function reorderPageSections(
  input: ReorderPageSectionsInput,
  actor: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const page = await repo.getPageById(tx, input.pageId);
    if (!page) {
      throw new DomainError('NOT_FOUND', 'Page not found');
    }

    await repo.reorderSections(tx, input.pageId, input.sectionIds);

    await audit(tx, {
      actorId: actor.userId,
      action: 'page_section.reorder',
      entity: 'page',
      entityId: page.id,
      after: { order: input.sectionIds },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    revalidateTag(`page:${page.slug}`, 'max');
  });
}

// =============================================================================================
// Helper Mappers
// =============================================================================================

function mapPageDetail(p: NonNullable<Awaited<ReturnType<typeof repo.getPageById>>>): PageDetail {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    status: p.status,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    ogImageUrl: p.ogImageUrl,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    sections: p.sections.map((s) => mapSectionItem(s)),
  };
}

function mapSectionItem(
  s: NonNullable<Awaited<ReturnType<typeof repo.getPageById>>>['sections'][number],
): PageSectionItem {
  return {
    id: s.id,
    pageId: s.pageId,
    blockType: s.blockType as PageSectionItem['blockType'],
    name: s.name,
    props: (s.props ?? {}) as Record<string, unknown>,
    sortOrder: s.sortOrder,
    isVisible: s.isVisible,
    startsAt: s.startsAt ? s.startsAt.toISOString() : null,
    endsAt: s.endsAt ? s.endsAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
