import 'server-only';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';
import type { BlockCustomerInput, SaveAddressInput, UpdateProfileInput } from './schemas';

export async function saveAddress(userId: string, input: SaveAddressInput) {
  return db.$transaction(async (tx) => {
    const count = await repo.countAddresses(tx, userId);
    const shouldBeDefault = input.isDefault || count === 0;

    if (shouldBeDefault) {
      await repo.unsetDefaultAddresses(tx, userId);
    }

    if (input.id) {
      const existing = await repo.findAddressById(tx, userId, input.id);
      if (!existing) {
        throw new DomainError('NOT_FOUND', 'Address not found.');
      }
      return repo.updateAddress(tx, userId, input.id, {
        ...input,
        isDefault: shouldBeDefault,
      });
    }

    return repo.createAddress(tx, userId, {
      ...input,
      isDefault: shouldBeDefault,
    });
  });
}

export async function deleteAddress(userId: string, addressId: string) {
  return db.$transaction(async (tx) => {
    const existing = await repo.findAddressById(tx, userId, addressId);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Address not found.');
    }
    await repo.deleteAddress(tx, userId, addressId);

    // If deleted address was default, promote another address to default if any exists
    if (existing.isDefault) {
      const remaining = await repo.findAddressesByUserId(tx, userId);
      const first = remaining[0];
      if (first) {
        await repo.setDefaultAddress(tx, userId, first.id);
      }
    }
    return { success: true };
  });
}

export async function setDefaultAddress(userId: string, addressId: string) {
  return db.$transaction(async (tx) => {
    const existing = await repo.findAddressById(tx, userId, addressId);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Address not found.');
    }
    return repo.setDefaultAddress(tx, userId, addressId);
  });
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  return db.$transaction(async (tx) => {
    return repo.updateCustomerProfile(tx, userId, input);
  });
}

export async function blockCustomer(staffUserId: string, input: BlockCustomerInput) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.customerId },
      select: { id: true, banned: true },
    });
    if (!user) {
      throw new DomainError('NOT_FOUND', 'Customer not found.');
    }

    const updated = await repo.setCustomerBlockedStatus(tx, input.customerId, true);

    await audit(tx, {
      actorId: staffUserId,
      action: 'customer.block',
      entity: 'user',
      entityId: input.customerId,
      before: { banned: user.banned },
      after: { banned: true, reason: input.reason },
    });

    return updated;
  });
}

export async function unblockCustomer(staffUserId: string, customerId: string) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: customerId },
      select: { id: true, banned: true },
    });
    if (!user) {
      throw new DomainError('NOT_FOUND', 'Customer not found.');
    }

    const updated = await repo.setCustomerBlockedStatus(tx, customerId, false);

    await audit(tx, {
      actorId: staffUserId,
      action: 'customer.unblock',
      entity: 'user',
      entityId: customerId,
      before: { banned: user.banned },
      after: { banned: false },
    });

    return updated;
  });
}
