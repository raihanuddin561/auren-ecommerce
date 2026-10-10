import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';
import type {
  LookbookListItem,
  LookbookDetailItem,
  LookbookFilterParams,
  CreateLookbookInput,
  UpdateLookbookInput,
  CreateSlideInput,
  UpdateSlideInput,
  CreateHotspotInput,
  UpdateHotspotInput,
} from './types';

export interface AuditActor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function listLookbooks(filter?: LookbookFilterParams): Promise<LookbookListItem[]> {
  return repo.listLookbooks(filter);
}

export async function getLookbookBySlug(
  slug: string,
  onlyPublished = true,
): Promise<LookbookDetailItem | null> {
  return repo.getLookbookBySlug(slug, onlyPublished);
}

export async function getLookbookById(id: string): Promise<LookbookDetailItem | null> {
  return repo.getLookbookById(id);
}

export async function createLookbook(
  input: CreateLookbookInput,
  actor: AuditActor,
): Promise<{ id: string; slug: string }> {
  return db.$transaction(async (tx) => {
    const existing = await tx.lookbook.findUnique({ where: { slug: input.slug } });
    if (existing) {
      throw new DomainError('CONFLICT', `A lookbook with slug "${input.slug}" already exists`);
    }

    const created = await repo.createLookbook(input);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook.create',
      entity: 'lookbook',
      entityId: created.id,
      after: { title: input.title, slug: input.slug, season: input.season, status: input.status },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag('lookbooks', 'max');
    } catch {
      // In test context
    }

    return created;
  });
}

export async function updateLookbook(input: UpdateLookbookInput, actor: AuditActor): Promise<void> {
  return db.$transaction(async (tx) => {
    const current = await tx.lookbook.findUnique({ where: { id: input.id } });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Lookbook not found');
    }

    if (input.slug && input.slug !== current.slug) {
      const existing = await tx.lookbook.findUnique({ where: { slug: input.slug } });
      if (existing && existing.id !== input.id) {
        throw new DomainError('CONFLICT', `A lookbook with slug "${input.slug}" already exists`);
      }
    }

    const updated = await repo.updateLookbook(input.id, input);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook.update',
      entity: 'lookbook',
      entityId: updated.id,
      before: { title: current.title, slug: current.slug, status: current.status },
      after: { title: updated.title, slug: updated.slug, status: updated.status },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag('lookbooks', 'max');
      revalidateTag(`lookbook:${current.slug}`, 'max');
      if (updated.slug !== current.slug) {
        revalidateTag(`lookbook:${updated.slug}`, 'max');
      }
    } catch {
      // In test context
    }
  });
}

export async function deleteLookbook(id: string, actor: AuditActor): Promise<void> {
  return db.$transaction(async (tx) => {
    const current = await tx.lookbook.findUnique({ where: { id } });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Lookbook not found');
    }

    await repo.deleteLookbook(id);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook.delete',
      entity: 'lookbook',
      entityId: id,
      before: { title: current.title, slug: current.slug },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag('lookbooks', 'max');
      revalidateTag(`lookbook:${current.slug}`, 'max');
    } catch {
      // In test context
    }
  });
}

export async function addSlide(input: CreateSlideInput, actor: AuditActor) {
  return db.$transaction(async (tx) => {
    const lookbook = await tx.lookbook.findUnique({ where: { id: input.lookbookId } });
    if (!lookbook) {
      throw new DomainError('NOT_FOUND', 'Lookbook not found');
    }

    const slide = await repo.createSlide(input);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook_slide.create',
      entity: 'lookbook_slide',
      entityId: slide.id,
      after: { lookbookId: input.lookbookId, title: input.title, imageUrl: input.imageUrl },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag(`lookbook:${lookbook.slug}`, 'max');
    } catch {
      // In test context
    }

    return slide;
  });
}

export async function updateSlide(input: UpdateSlideInput, actor: AuditActor) {
  return db.$transaction(async (tx) => {
    const slide = await tx.lookbookSlide.findUnique({
      where: { id: input.id },
      include: { lookbook: { select: { slug: true } } },
    });
    if (!slide) {
      throw new DomainError('NOT_FOUND', 'Slide not found');
    }

    const updated = await repo.updateSlide(input.id, input);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook_slide.update',
      entity: 'lookbook_slide',
      entityId: updated.id,
      before: { title: slide.title, imageUrl: slide.imageUrl },
      after: { title: updated.title, imageUrl: updated.imageUrl },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag(`lookbook:${slide.lookbook.slug}`, 'max');
    } catch {
      // In test context
    }

    return updated;
  });
}

export async function deleteSlide(id: string, lookbookId: string, actor: AuditActor) {
  return db.$transaction(async (tx) => {
    const slide = await tx.lookbookSlide.findUnique({
      where: { id },
      include: { lookbook: { select: { slug: true } } },
    });
    if (!slide) {
      throw new DomainError('NOT_FOUND', 'Slide not found');
    }

    await repo.deleteSlide(id);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook_slide.delete',
      entity: 'lookbook_slide',
      entityId: id,
      before: { lookbookId, title: slide.title },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag(`lookbook:${slide.lookbook.slug}`, 'max');
    } catch {
      // In test context
    }
  });
}

export async function reorderSlides(lookbookId: string, slideIds: string[], actor: AuditActor) {
  return db.$transaction(async (tx) => {
    const lookbook = await tx.lookbook.findUnique({ where: { id: lookbookId } });
    if (!lookbook) {
      throw new DomainError('NOT_FOUND', 'Lookbook not found');
    }

    await repo.reorderSlides(lookbookId, slideIds);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook_slide.reorder',
      entity: 'lookbook',
      entityId: lookbookId,
      after: { count: slideIds.length },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag(`lookbook:${lookbook.slug}`, 'max');
    } catch {
      // In test context
    }
  });
}

export async function addHotspot(input: CreateHotspotInput, actor: AuditActor) {
  return db.$transaction(async (tx) => {
    const slide = await tx.lookbookSlide.findUnique({
      where: { id: input.slideId },
      include: { lookbook: { select: { slug: true } } },
    });
    if (!slide) {
      throw new DomainError('NOT_FOUND', 'Slide not found');
    }

    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) {
      throw new DomainError('NOT_FOUND', 'Product not found');
    }

    const hotspot = await repo.createHotspot(input);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook_hotspot.create',
      entity: 'lookbook_hotspot',
      entityId: hotspot.id,
      after: { slideId: input.slideId, productId: input.productId, x: input.x, y: input.y },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag(`lookbook:${slide.lookbook.slug}`, 'max');
    } catch {
      // In test context
    }

    return hotspot;
  });
}

export async function updateHotspot(input: UpdateHotspotInput, actor: AuditActor) {
  return db.$transaction(async (tx) => {
    const hotspot = await tx.lookbookHotspot.findUnique({
      where: { id: input.id },
      include: { slide: { include: { lookbook: { select: { slug: true } } } } },
    });
    if (!hotspot) {
      throw new DomainError('NOT_FOUND', 'Hotspot not found');
    }

    const updated = await repo.updateHotspot(input.id, input);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook_hotspot.update',
      entity: 'lookbook_hotspot',
      entityId: updated.id,
      before: { x: hotspot.x, y: hotspot.y, label: hotspot.label },
      after: { x: updated.x, y: updated.y, label: updated.label },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag(`lookbook:${hotspot.slide.lookbook.slug}`, 'max');
    } catch {
      // In test context
    }

    return updated;
  });
}

export async function deleteHotspot(id: string, actor: AuditActor) {
  return db.$transaction(async (tx) => {
    const hotspot = await tx.lookbookHotspot.findUnique({
      where: { id },
      include: { slide: { include: { lookbook: { select: { slug: true } } } } },
    });
    if (!hotspot) {
      throw new DomainError('NOT_FOUND', 'Hotspot not found');
    }

    await repo.deleteHotspot(id);

    await audit(tx, {
      actorId: actor.userId,
      action: 'lookbook_hotspot.delete',
      entity: 'lookbook_hotspot',
      entityId: id,
      before: { slideId: hotspot.slideId, productId: hotspot.productId },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag(`lookbook:${hotspot.slide.lookbook.slug}`, 'max');
    } catch {
      // In test context
    }
  });
}

export async function searchProductsForHotspots(query: string) {
  return repo.searchProductsForHotspots(query);
}
