import { z } from 'zod';
import { STAFF_ROLES } from '@/lib/permissions';

export const createStaffSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().toLowerCase().email('A valid email address is required'),
    role: z.enum(STAFF_ROLES, {
      message: 'Invalid staff role',
    }),
    temporaryPassword: z
      .string()
      .min(10, 'Temporary password must be at least 10 characters')
      .max(100)
      .optional(),
  })
  .strict();

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffRoleSchema = z
  .object({
    staffId: z.string().uuid(),
    role: z.enum(STAFF_ROLES, {
      message: 'Invalid staff role',
    }),
  })
  .strict();

export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;

export const toggleStaffStatusSchema = z
  .object({
    staffId: z.string().uuid(),
    active: z.boolean(),
  })
  .strict();

export type ToggleStaffStatusInput = z.infer<typeof toggleStaffStatusSchema>;
