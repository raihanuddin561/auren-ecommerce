import { z } from 'zod';

export const saveAddressSchema = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().trim().max(50).optional().default('Home'),
    fullName: z.string().trim().min(2, 'Full name is required').max(100),
    phone: z.string().trim().min(8, 'Phone number is required').max(20),
    divisionId: z.string().uuid('Please select a division'),
    districtId: z.string().uuid('Please select a district'),
    thanaId: z.string().uuid().optional().nullable(),
    thanaName: z.string().trim().max(100).optional().nullable(),
    area: z.string().trim().max(100).optional().nullable(),
    line1: z.string().trim().min(5, 'Street address is required').max(200),
    line2: z.string().trim().max(200).optional().nullable(),
    postalCode: z.string().trim().max(20).optional().nullable(),
    isDefault: z.boolean().default(false),
  })
  .strict();

export type SaveAddressInput = z.infer<typeof saveAddressSchema>;

export const deleteAddressSchema = z
  .object({
    addressId: z.string().uuid(),
  })
  .strict();

export const setDefaultAddressSchema = z
  .object({
    addressId: z.string().uuid(),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    phone: z.string().trim().max(20).optional().nullable(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
