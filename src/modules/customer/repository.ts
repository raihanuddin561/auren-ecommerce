import type { Tx } from '@/lib/db';
import type { SaveAddressInput, UpdateProfileInput } from './schemas';

export async function findAddressesByUserId(tx: Tx, userId: string) {
  return tx.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function findAddressById(tx: Tx, userId: string, addressId: string) {
  return tx.address.findFirst({
    where: { id: addressId, userId },
  });
}

export async function countAddresses(tx: Tx, userId: string) {
  return tx.address.count({ where: { userId } });
}

export async function unsetDefaultAddresses(tx: Tx, userId: string) {
  return tx.address.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  });
}

export async function createAddress(tx: Tx, userId: string, data: SaveAddressInput) {
  return tx.address.create({
    data: {
      userId,
      label: data.label ?? 'Home',
      fullName: data.fullName,
      phone: data.phone,
      divisionId: data.divisionId,
      districtId: data.districtId,
      thanaId: data.thanaId ?? null,
      thanaName: data.thanaName ?? null,
      area: data.area ?? null,
      line1: data.line1,
      line2: data.line2 ?? null,
      postalCode: data.postalCode ?? null,
      isDefault: data.isDefault,
    },
  });
}

export async function updateAddress(
  tx: Tx,
  userId: string,
  addressId: string,
  data: SaveAddressInput,
) {
  return tx.address.update({
    where: { id: addressId, userId },
    data: {
      label: data.label ?? 'Home',
      fullName: data.fullName,
      phone: data.phone,
      divisionId: data.divisionId,
      districtId: data.districtId,
      thanaId: data.thanaId ?? null,
      thanaName: data.thanaName ?? null,
      area: data.area ?? null,
      line1: data.line1,
      line2: data.line2 ?? null,
      postalCode: data.postalCode ?? null,
      isDefault: data.isDefault,
    },
  });
}

export async function deleteAddress(tx: Tx, userId: string, addressId: string) {
  return tx.address.delete({
    where: { id: addressId, userId },
  });
}

export async function setDefaultAddress(tx: Tx, userId: string, addressId: string) {
  await tx.address.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  });
  return tx.address.update({
    where: { id: addressId, userId },
    data: { isDefault: true },
  });
}

export async function findCustomerOrders(tx: Tx, userId: string) {
  return tx.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  media: {
                    orderBy: { position: 'asc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function findCustomerProfile(tx: Tx, userId: string) {
  return tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      createdAt: true,
    },
  });
}

export async function updateCustomerProfile(tx: Tx, userId: string, data: UpdateProfileInput) {
  return tx.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      phone: data.phone ?? undefined,
    },
  });
}
