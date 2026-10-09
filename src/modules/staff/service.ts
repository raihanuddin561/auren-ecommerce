import { randomBytes } from 'node:crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import type { StaffContext } from '@/lib/permissions';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';
import type { CreateStaffInput, ToggleStaffStatusInput, UpdateStaffRoleInput } from './schemas';
import type { StaffMemberRecord } from './types';

export async function listStaff(): Promise<StaffMemberRecord[]> {
  return repo.listStaffMembers(db);
}

export async function inviteStaffMember(
  actor: StaffContext,
  input: CreateStaffInput,
): Promise<{ record: StaffMemberRecord; temporaryPassword: string }> {
  const existing = await repo.findUserByEmail(db, input.email);
  if (existing?.staffMember) {
    throw new DomainError('CONFLICT', 'A staff member with this email address already exists.');
  }

  // Only owner can assign owner or admin role
  if ((input.role === 'owner' || input.role === 'admin') && actor.role !== 'owner') {
    throw new DomainError('FORBIDDEN', 'Only the store owner can assign Owner or Admin roles.');
  }

  const temporaryPassword = input.temporaryPassword ?? randomBytes(12).toString('base64url');

  const context = await auth.$context;
  const passwordHash = await context.password.hash(temporaryPassword);

  const created = await db.$transaction(async (tx) => {
    const record = await repo.createStaffUserAndMember(tx, {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      invitedBy: actor.id,
    });

    await audit(tx, {
      actorId: actor.userId,
      action: 'staff.create',
      entity: 'staff_member',
      entityId: record.id,
      after: {
        userId: record.userId,
        email: record.email,
        name: record.name,
        role: record.role,
      },
    });

    return record;
  });

  return { record: created, temporaryPassword };
}

export async function updateStaffRole(
  actor: StaffContext,
  input: UpdateStaffRoleInput,
): Promise<StaffMemberRecord> {
  const target = await repo.findStaffMemberById(db, input.staffId);
  if (!target) {
    throw new DomainError('NOT_FOUND', 'Staff member not found.');
  }

  if (target.id === actor.id) {
    throw new DomainError('FORBIDDEN', 'You cannot change your own staff role.');
  }

  if (target.role === 'owner' && actor.role !== 'owner') {
    throw new DomainError('FORBIDDEN', 'Only the owner can modify an owner account.');
  }

  if (input.role === 'owner' && actor.role !== 'owner') {
    throw new DomainError('FORBIDDEN', 'Only the owner can grant owner privileges.');
  }

  const updated = await db.$transaction(async (tx) => {
    const record = await repo.updateStaffRole(tx, target.id, input.role);

    await audit(tx, {
      actorId: actor.userId,
      action: 'staff.role_change',
      entity: 'staff_member',
      entityId: record.id,
      before: { role: target.role },
      after: { role: input.role },
    });

    return record;
  });

  return updated;
}

export async function toggleStaffActive(
  actor: StaffContext,
  input: ToggleStaffStatusInput,
): Promise<StaffMemberRecord> {
  const target = await repo.findStaffMemberById(db, input.staffId);
  if (!target) {
    throw new DomainError('NOT_FOUND', 'Staff member not found.');
  }

  if (target.id === actor.id) {
    throw new DomainError('FORBIDDEN', 'You cannot deactivate your own account.');
  }

  if (target.role === 'owner') {
    throw new DomainError('FORBIDDEN', 'The store owner account cannot be deactivated.');
  }

  const updated = await db.$transaction(async (tx) => {
    const record = await repo.setStaffActive(tx, target.id, input.active);

    await audit(tx, {
      actorId: actor.userId,
      action: input.active ? 'staff.activate' : 'staff.deactivate',
      entity: 'staff_member',
      entityId: record.id,
      before: { active: target.active },
      after: { active: input.active },
    });

    return record;
  });

  return updated;
}
