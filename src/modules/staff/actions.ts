'use server';

import { revalidatePath } from 'next/cache';
import { ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { createStaffSchema, toggleStaffStatusSchema, updateStaffRoleSchema } from './schemas';
import * as service from './service';
import type { StaffMemberRecord } from './types';

export async function createStaffMemberAction(
  input: unknown,
): Promise<ActionResult<{ record: StaffMemberRecord; temporaryPassword: string }>> {
  const staff = await requireStaff();
  assertPermission(staff, 'staff.manage');

  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const result = await service.inviteStaffMember(staff, parsed.data);
    revalidatePath('/admin/settings/staff');
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateStaffRoleAction(
  input: unknown,
): Promise<ActionResult<StaffMemberRecord>> {
  const staff = await requireStaff();
  assertPermission(staff, 'staff.manage');

  const parsed = updateStaffRoleSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const record = await service.updateStaffRole(staff, parsed.data);
    revalidatePath('/admin/settings/staff');
    return ok(record);
  } catch (error) {
    return toActionError(error);
  }
}

export async function toggleStaffStatusAction(
  input: unknown,
): Promise<ActionResult<StaffMemberRecord>> {
  const staff = await requireStaff();
  assertPermission(staff, 'staff.manage');

  const parsed = toggleStaffStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const record = await service.toggleStaffActive(staff, parsed.data);
    revalidatePath('/admin/settings/staff');
    return ok(record);
  } catch (error) {
    return toActionError(error);
  }
}
