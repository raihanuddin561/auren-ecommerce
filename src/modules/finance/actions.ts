'use server';

import { revalidatePath } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  createMarketingCampaignSchema,
  createRecurringExpenseSchema,
  expenseFilterSchema,
  pAndLFilterSchema,
  updateExpenseCategorySchema,
  updateExpenseSchema,
  updateMarketingCampaignSchema,
  updateRecurringExpenseSchema,
} from './schemas';
import * as service from './service';

// =============================================================================================
// Expense Actions
// =============================================================================================

export async function createExpenseAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    const parsed = createExpenseSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const id = await service.createExpense(parsed.data, {
      userId: staff.userId,
      staffId: staff.id,
    });

    revalidatePath('/admin/finance');
    return ok({ id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateExpenseAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    const parsed = updateExpenseSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updateExpense(parsed.data, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    await service.deleteExpense(id, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

// =============================================================================================
// Category Actions
// =============================================================================================

export async function createExpenseCategoryAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    const parsed = createExpenseCategorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const id = await service.createExpenseCategory(parsed.data, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok({ id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateExpenseCategoryAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    const parsed = updateExpenseCategorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updateExpenseCategory(parsed.data, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteExpenseCategoryAction(id: string): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    await service.deleteExpenseCategory(id, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

// =============================================================================================
// Campaign Actions
// =============================================================================================

export async function createMarketingCampaignAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    const parsed = createMarketingCampaignSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const id = await service.createMarketingCampaign(parsed.data, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok({ id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateMarketingCampaignAction(
  rawInput: unknown,
): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    const parsed = updateMarketingCampaignSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updateMarketingCampaign(parsed.data, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteMarketingCampaignAction(id: string): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    await service.deleteMarketingCampaign(id, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

// =============================================================================================
// Recurring Expense Actions
// =============================================================================================

export async function createRecurringExpenseAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    const parsed = createRecurringExpenseSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const id = await service.createRecurringExpense(parsed.data, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok({ id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateRecurringExpenseAction(rawInput: unknown): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    const parsed = updateRecurringExpenseSchema.safeParse(rawInput);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    await service.updateRecurringExpense(parsed.data, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteRecurringExpenseAction(id: string): Promise<ActionResult<void>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.write');

    await service.deleteRecurringExpense(id, { userId: staff.userId });
    revalidatePath('/admin/finance');
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

// =============================================================================================
// Export CSV Actions
// =============================================================================================

export async function exportExpensesCsvAction(
  rawFilter: unknown,
): Promise<ActionResult<{ csv: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.read');

    const parsed = expenseFilterSchema.partial().safeParse(rawFilter ?? {});
    const filter = parsed.success ? parsed.data : {};
    const csv = await service.exportExpensesCsv(filter);
    return ok({ csv });
  } catch (error) {
    return toActionError(error);
  }
}

export async function exportProfitAndLossCsvAction(
  rawFilter: unknown,
): Promise<ActionResult<{ csv: string }>> {
  try {
    const staff = await requireStaff();
    assertPermission(staff, 'finance.read');

    const parsed = pAndLFilterSchema.safeParse(rawFilter);
    const filter = parsed.success
      ? parsed.data
      : { recognitionMode: 'delivered' as const, grouping: 'month' as const };
    const csv = await service.exportProfitAndLossCsv(filter);
    return ok({ csv });
  } catch (error) {
    return toActionError(error);
  }
}
