import 'server-only';
import { db } from '@/lib/db';
import * as repo from './repository';

export async function getCustomerAddresses(userId: string) {
  return repo.findAddressesByUserId(db, userId);
}

export async function getCustomerOrders(userId: string) {
  return repo.findCustomerOrders(db, userId);
}

export async function getCustomerProfile(userId: string) {
  return repo.findCustomerProfile(db, userId);
}

export async function getCustomerDashboardData(userId: string) {
  const [profile, orders, addresses] = await Promise.all([
    repo.findCustomerProfile(db, userId),
    repo.findCustomerOrders(db, userId),
    repo.findAddressesByUserId(db, userId),
  ]);

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const recentOrders = orders.slice(0, 3);

  return {
    profile,
    ordersCount: orders.length,
    recentOrders,
    addressesCount: addresses.length,
    defaultAddress,
  };
}
