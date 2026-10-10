'use server';

import { revalidatePath } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import {
  createLookbookSchema,
  updateLookbookSchema,
  createSlideSchema,
  updateSlideSchema,
  createHotspotSchema,
  updateHotspotSchema,
} from './schemas';
import type { ProductSummaryForHotspot } from './types';
import * as service from './service';

export async function createLookbookAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = createLookbookSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const result = await service.createLookbook(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateLookbookAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = updateLookbookSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updateLookbook(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteLookbookAction(id: string): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    await service.deleteLookbook(id, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function addSlideAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = createSlideSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const slide = await service.addSlide(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok({ id: slide.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateSlideAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = updateSlideSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updateSlide(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteSlideAction(
  id: string,
  lookbookId: string,
): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    await service.deleteSlide(id, lookbookId, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function reorderSlidesAction(
  lookbookId: string,
  slideIds: string[],
): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    await service.reorderSlides(lookbookId, slideIds, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function addHotspotAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = createHotspotSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const hotspot = await service.addHotspot(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok({ id: hotspot.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateHotspotAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const parsed = updateHotspotSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updateHotspot(parsed.data, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteHotspotAction(
  id: string,
  _lookbookId: string,
): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    await service.deleteHotspot(id, {
      userId: staff.userId,
    });

    revalidatePath('/admin/lookbooks');
    revalidatePath('/lookbook');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function searchProductsForHotspotsAction(
  query: string,
): Promise<ActionResult<ProductSummaryForHotspot[]>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'content.manage');

    const results = await service.searchProductsForHotspots(query);
    return ok(results);
  } catch (error) {
    return toActionError(error);
  }
}
