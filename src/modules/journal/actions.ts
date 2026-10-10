'use server';

import { revalidatePath } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { createArticleSchema, updateArticleSchema } from './schemas';
import * as service from './service';

export async function createArticleAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = createArticleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const result = await service.createArticle(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/journal');
    revalidatePath('/journal');
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateArticleAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = updateArticleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updateArticle(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/journal');
    revalidatePath('/journal');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteArticleAction(id: string): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    await service.deleteArticle(id, {
      userId: staff.userId,
    });

    revalidatePath('/admin/journal');
    revalidatePath('/journal');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}
