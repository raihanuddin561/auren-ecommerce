'use server';

import { revalidatePath } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import {
  createPageSchema,
  createPageSectionSchema,
  reorderPageSectionsSchema,
  updatePageSchema,
  updatePageSectionSchema,
} from './schemas';
import * as service from './service';

// =============================================================================================
// Page Actions
// =============================================================================================

export async function createPageAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = createPageSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const id = await service.createPage(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/content');
    return ok({ id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePageAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = updatePageSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updatePage(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/content');
    revalidatePath(`/admin/content/${parsed.data.id}`);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deletePageAction(id: string): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    await service.deletePage(id, {
      userId: staff.userId,
    });

    revalidatePath('/admin/content');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

// =============================================================================================
// Section Actions
// =============================================================================================

export async function createPageSectionAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = createPageSectionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const id = await service.createPageSection(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath(`/admin/content/${parsed.data.pageId}`);
    return ok({ id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePageSectionAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = updatePageSectionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updatePageSection(parsed.data, {
      userId: staff.userId,
    });

    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deletePageSectionAction(
  id: string,
  pageId: string,
): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    await service.deletePageSection(id, {
      userId: staff.userId,
    });

    revalidatePath(`/admin/content/${pageId}`);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function reorderPageSectionsAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = reorderPageSectionsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.reorderPageSections(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath(`/admin/content/${parsed.data.pageId}`);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}
