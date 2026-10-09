import type { PrismaClient } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';
import { newId } from '@/lib/ids';
import type { StaffRole } from '@/lib/permissions';
import type { StaffMemberRecord } from './types';

type DbOrTx = PrismaClient | Tx;

function toRecord(row: {
  id: string;
  userId: string;
  role: StaffRole;
  active: boolean;
  invitedBy: string | null;
  createdAt: Date;
  user: {
    name: string;
    email: string;
    twoFactorEnabled: boolean;
    mustChangePassword: boolean;
  };
}): StaffMemberRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    role: row.role,
    active: row.active,
    twoFactorEnabled: row.user.twoFactorEnabled,
    mustChangePassword: row.user.mustChangePassword,
    createdAt: row.createdAt.toISOString(),
    invitedBy: row.invitedBy,
  };
}

export async function listStaffMembers(db: DbOrTx): Promise<StaffMemberRecord[]> {
  const rows = await db.staffMember.findMany({
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: {
        select: {
          name: true,
          email: true,
          twoFactorEnabled: true,
          mustChangePassword: true,
        },
      },
    },
  });
  return rows.map(toRecord);
}

export async function findStaffMemberById(
  db: DbOrTx,
  id: string,
): Promise<StaffMemberRecord | null> {
  const row = await db.staffMember.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          twoFactorEnabled: true,
          mustChangePassword: true,
        },
      },
    },
  });
  return row ? toRecord(row) : null;
}

export async function findUserByEmail(db: DbOrTx, email: string) {
  return db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      staffMember: { select: { id: true, role: true, active: true } },
    },
  });
}

export async function createStaffUserAndMember(
  db: DbOrTx,
  input: {
    name: string;
    email: string;
    passwordHash: string;
    role: StaffRole;
    invitedBy: string;
  },
): Promise<StaffMemberRecord> {
  const userId = newId();
  const email = input.email.trim().toLowerCase();

  const user = await db.user.create({
    data: {
      id: userId,
      email,
      name: input.name,
      emailVerified: true,
      mustChangePassword: true,
      accounts: {
        create: {
          id: newId(),
          accountId: userId,
          providerId: 'credential',
          password: input.passwordHash,
        },
      },
      staffMember: {
        create: {
          role: input.role,
          active: true,
          invitedBy: input.invitedBy,
        },
      },
    },
    include: {
      staffMember: true,
    },
  });

  return {
    id: user.staffMember!.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.staffMember!.role,
    active: user.staffMember!.active,
    twoFactorEnabled: user.twoFactorEnabled,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.staffMember!.createdAt.toISOString(),
    invitedBy: user.staffMember!.invitedBy,
  };
}

export async function updateStaffRole(
  db: DbOrTx,
  id: string,
  role: StaffRole,
): Promise<StaffMemberRecord> {
  const updated = await db.staffMember.update({
    where: { id },
    data: { role },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          twoFactorEnabled: true,
          mustChangePassword: true,
        },
      },
    },
  });
  return toRecord(updated);
}

export async function setStaffActive(
  db: DbOrTx,
  id: string,
  active: boolean,
): Promise<StaffMemberRecord> {
  const updated = await db.staffMember.update({
    where: { id },
    data: { active },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          twoFactorEnabled: true,
          mustChangePassword: true,
        },
      },
    },
  });
  return toRecord(updated);
}
