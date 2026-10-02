import { faker } from '@faker-js/faker';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { newId } from '@/lib/ids';
import type { StaffRole } from '@/lib/permissions';

// Fixed seed: factories are realistic but never flaky.
faker.seed(20261001);

export const TEST_PASSWORD = 'Correct-horse-battery-9';

const menswearNames = [
  'Rahim Uddin',
  'Tanvir Hasan',
  'Imran Khan',
  'Sabbir Ahmed',
  'Nafis Chowdhury',
];
let counter = 0;
const nextEmail = (prefix: string) =>
  `${prefix}.${++counter}.${faker.string.alphanumeric(6).toLowerCase()}@auren.test`;

export interface MakeUserOptions {
  email?: string;
  name?: string;
  password?: string;
  emailVerified?: boolean;
  banned?: boolean;
}

async function createUserWithPassword(prefix: string, options: MakeUserOptions) {
  const context = await auth.$context;
  const password = options.password ?? TEST_PASSWORD;
  const hash = await context.password.hash(password);
  const email = options.email ?? nextEmail(prefix);
  const id = newId();
  const user = await db.user.create({
    data: {
      id,
      email,
      name: options.name ?? faker.helpers.arrayElement(menswearNames),
      emailVerified: options.emailVerified ?? true,
      banned: options.banned ?? false,
      // Better Auth looks the credential login up by account_id = user id.
      accounts: { create: { accountId: id, providerId: 'credential', password: hash } },
    },
  });
  return { user, email, password };
}

/** A verified customer with a password login. */
export async function makeCustomer(options: MakeUserOptions = {}) {
  return createUserWithPassword('customer', options);
}

export interface MakeStaffOptions extends MakeUserOptions {
  role?: StaffRole;
  /** Sets users.two_factor_enabled. Staff without it are sent to the security setup page. */
  twoFactor?: boolean;
  active?: boolean;
}

/** A staff member with the given role (default order_verifier). */
export async function makeStaff(options: MakeStaffOptions = {}) {
  const created = await createUserWithPassword('staff', options);
  const member = await db.staffMember.create({
    data: {
      userId: created.user.id,
      role: options.role ?? 'order_verifier',
      active: options.active ?? true,
    },
  });
  if (options.twoFactor ?? true) {
    await db.user.update({ where: { id: created.user.id }, data: { twoFactorEnabled: true } });
  }
  return { ...created, member };
}
