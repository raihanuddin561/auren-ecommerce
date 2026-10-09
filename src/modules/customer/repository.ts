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

export interface ListCustomersParams {
  search?: string;
  status?: 'active' | 'blocked';
  take?: number;
  skip?: number;
}

export async function listCustomersForAdmin(tx: Tx, params: ListCustomersParams = {}) {
  const take = params.take ?? 25;
  const skip = params.skip ?? 0;

  const where: Record<string, unknown> = {};
  if (params.status === 'active') {
    where.banned = false;
  } else if (params.status === 'blocked') {
    where.banned = true;
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    tx.user.count({ where }),
    tx.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        banned: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            status: true,
            totalMinor: true,
            currency: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            orders: true,
            addresses: true,
          },
        },
      },
    }),
  ]);

  const items = users.map((u) => {
    const validOrders = u.orders.filter((o) => o.status !== 'cancelled');
    const ltvMinor = validOrders.reduce((sum, o) => sum + o.totalMinor, 0n);
    const lastOrder = u.orders.length > 0 ? u.orders[0] : null;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      banned: Boolean(u.banned),
      createdAt: u.createdAt,
      ordersCount: u._count.orders,
      addressesCount: u._count.addresses,
      ltvMinor,
      currency: lastOrder?.currency ?? 'BDT',
      lastOrderAt: lastOrder?.createdAt ?? null,
    };
  });

  return { items, total, take, skip };
}

export async function findCustomerDetailForAdmin(tx: Tx, customerId: string) {
  const user = await tx.user.findUnique({
    where: { id: customerId },
    include: {
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      },
    },
  });

  if (!user) return null;

  const validOrders = user.orders.filter((o) => o.status !== 'cancelled');
  const ltvMinor = validOrders.reduce((sum, o) => sum + o.totalMinor, 0n);
  const aovMinor = validOrders.length > 0 ? ltvMinor / BigInt(validOrders.length) : 0n;

  return {
    ...user,
    banned: Boolean(user.banned),
    metrics: {
      ordersCount: user.orders.length,
      validOrdersCount: validOrders.length,
      ltvMinor,
      aovMinor,
      currency: user.orders[0]?.currency ?? 'BDT',
      firstOrderAt: user.orders[user.orders.length - 1]?.createdAt ?? null,
      lastOrderAt: user.orders[0]?.createdAt ?? null,
    },
  };
}

export async function setCustomerBlockedStatus(tx: Tx, customerId: string, banned: boolean) {
  const user = await tx.user.update({
    where: { id: customerId },
    data: { banned },
  });

  if (banned) {
    await tx.session.deleteMany({
      where: { userId: customerId },
    });
  }

  return user;
}
