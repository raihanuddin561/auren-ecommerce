'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, toActionError, validationError, type ActionResult } from '@/lib/action-result';
import { getSession } from '@/lib/auth';
import { assertPermission } from '@/lib/permissions';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { requireStaff } from '@/lib/staff';
import {
  blockCustomerSchema,
  deleteAddressSchema,
  saveAddressSchema,
  setDefaultAddressSchema,
  unblockCustomerSchema,
  updateProfileSchema,
} from './schemas';
import * as customer from './service';

export async function saveAddressAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = saveAddressSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const session = await getSession();
    if (!session || session.user.banned) {
      return fail('UNAUTHENTICATED', 'You must be signed in to manage your addresses.');
    }

    const { ip } = await getRequestMeta();
    const limited = await rateLimit('authMutation', `${session.user.id}:${ip}`);
    if (!limited.success) return fail('RATE_LIMITED');

    const address = await customer.saveAddress(session.user.id, parsed.data);
    revalidatePath('/account/addresses');
    revalidatePath('/account');
    return ok({ id: address.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAddressAction(
  input: unknown,
): Promise<ActionResult<{ success: boolean }>> {
  const parsed = deleteAddressSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const session = await getSession();
    if (!session || session.user.banned) {
      return fail('UNAUTHENTICATED', 'You must be signed in to manage your addresses.');
    }

    const { ip } = await getRequestMeta();
    const limited = await rateLimit('authMutation', `${session.user.id}:${ip}`);
    if (!limited.success) return fail('RATE_LIMITED');

    const result = await customer.deleteAddress(session.user.id, parsed.data.addressId);
    revalidatePath('/account/addresses');
    revalidatePath('/account');
    return ok(result);
  } catch (error) {
    return toActionError(error);
  }
}

export async function setDefaultAddressAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = setDefaultAddressSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const session = await getSession();
    if (!session || session.user.banned) {
      return fail('UNAUTHENTICATED', 'You must be signed in to manage your addresses.');
    }

    const { ip } = await getRequestMeta();
    const limited = await rateLimit('authMutation', `${session.user.id}:${ip}`);
    if (!limited.success) return fail('RATE_LIMITED');

    const address = await customer.setDefaultAddress(session.user.id, parsed.data.addressId);
    revalidatePath('/account/addresses');
    revalidatePath('/account');
    return ok({ id: address.id });
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const session = await getSession();
    if (!session || session.user.banned) {
      return fail('UNAUTHENTICATED', 'You must be signed in to update your profile.');
    }

    const { ip } = await getRequestMeta();
    const limited = await rateLimit('authMutation', `${session.user.id}:${ip}`);
    if (!limited.success) return fail('RATE_LIMITED');

    const updated = await customer.updateProfile(session.user.id, parsed.data);
    revalidatePath('/account/profile');
    revalidatePath('/account');
    return ok({ id: updated.id, name: updated.name });
  } catch (error) {
    return toActionError(error);
  }
}

export async function blockCustomerAction(
  input: unknown,
): Promise<ActionResult<{ customerId: string }>> {
  const parsed = blockCustomerSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const staff = await requireStaff();
    assertPermission(staff, 'customers.write');

    await customer.blockCustomer(staff.userId, parsed.data);
    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${parsed.data.customerId}`);
    return ok({ customerId: parsed.data.customerId });
  } catch (error) {
    return toActionError(error);
  }
}

export async function unblockCustomerAction(
  input: unknown,
): Promise<ActionResult<{ customerId: string }>> {
  const parsed = unblockCustomerSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const staff = await requireStaff();
    assertPermission(staff, 'customers.write');

    await customer.unblockCustomer(staff.userId, parsed.data.customerId);
    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${parsed.data.customerId}`);
    return ok({ customerId: parsed.data.customerId });
  } catch (error) {
    return toActionError(error);
  }
}
