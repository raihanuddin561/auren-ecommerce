import { describe, expect, it } from 'vitest';
import { createStaffSchema, toggleStaffStatusSchema, updateStaffRoleSchema } from '../schemas';

describe('15.4 Staff Management Schemas & Invariants', () => {
  it('validates a correct new staff invite payload', () => {
    const valid = {
      name: 'Nafis Ahmed',
      email: 'nafis@auren.com',
      role: 'order_verifier',
      temporaryPassword: 'TemporaryPass123!',
    };

    const parsed = createStaffSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Nafis Ahmed');
      expect(parsed.data.email).toBe('nafis@auren.com');
      expect(parsed.data.role).toBe('order_verifier');
    }
  });

  it('allows omitted temporary password for auto-generation', () => {
    const valid = {
      name: 'Tanvir Hossain',
      email: 'tanvir@auren.com',
      role: 'fulfillment',
    };

    const parsed = createStaffSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.temporaryPassword).toBeUndefined();
    }
  });

  it('rejects invalid email or short names', () => {
    expect(
      createStaffSchema.safeParse({
        name: 'A',
        email: 'invalid-email',
        role: 'manager',
      }).success,
    ).toBe(false);
  });

  it('rejects unknown staff roles', () => {
    expect(
      createStaffSchema.safeParse({
        name: 'Staff Name',
        email: 'staff@auren.com',
        role: 'super_admin_does_not_exist',
      }).success,
    ).toBe(false);
  });

  it('validates role update payload with UUID', () => {
    const valid = {
      staffId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      role: 'finance',
    };
    expect(updateStaffRoleSchema.safeParse(valid).success).toBe(true);

    const invalidUuid = {
      staffId: 'not-a-uuid',
      role: 'finance',
    };
    expect(updateStaffRoleSchema.safeParse(invalidUuid).success).toBe(false);
  });

  it('validates status toggle payload with UUID', () => {
    const valid = {
      staffId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      active: false,
    };
    expect(toggleStaffStatusSchema.safeParse(valid).success).toBe(true);
  });
});
