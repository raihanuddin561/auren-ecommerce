import 'server-only';
import { auth } from './auth';
import { db } from './db';
import { newId } from './ids';

export interface OwnerInput {
  email: string;
  name: string;
  password: string;
}

export interface OwnerResult {
  userId: string;
  created: boolean;
}

/**
 * Creates the store owner: a verified user with a credential login and the `owner` staff role.
 * Safe to run again with the same email. The owner still has to enrol two-factor authentication
 * on first sign-in, like every other staff member.
 *
 * Used by `pnpm owner:create` for first-time setup and by the development seed.
 */
export async function ensureOwnerAccount(input: OwnerInput): Promise<OwnerResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, staffMember: { select: { id: true, role: true } } },
  });

  if (existing) {
    if (existing.staffMember?.role === 'owner') return { userId: existing.id, created: false };
    await db.$transaction([
      db.user.update({ where: { id: existing.id }, data: { emailVerified: true } }),
      db.staffMember.upsert({
        where: { userId: existing.id },
        create: { userId: existing.id, role: 'owner' },
        update: { role: 'owner', active: true },
      }),
    ]);
    return { userId: existing.id, created: false };
  }

  const context = await auth.$context;
  const passwordHash = await context.password.hash(input.password);
  // Better Auth finds the credential login through account_id = user id, so allocate the id first.
  const userId = newId();
  const user = await db.user.create({
    data: {
      id: userId,
      name: input.name,
      email,
      emailVerified: true,
      staffMember: { create: { role: 'owner' } },
      accounts: {
        create: { accountId: userId, providerId: 'credential', password: passwordHash },
      },
    },
    select: { id: true },
  });
  return { userId: user.id, created: true };
}
