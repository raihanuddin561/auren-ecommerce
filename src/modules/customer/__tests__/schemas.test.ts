import { describe, expect, it } from 'vitest';
import {
  deleteAddressSchema,
  saveAddressSchema,
  setDefaultAddressSchema,
  updateProfileSchema,
} from '../schemas';

const uuid = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4e';
const uuid2 = '0198f4a2-7c3d-7a10-8a55-2f0a1b2c3d4f';

describe('customer schemas', () => {
  describe('saveAddressSchema', () => {
    it('validates a complete address input', () => {
      const result = saveAddressSchema.safeParse({
        label: 'Home',
        fullName: 'Raihan Uddin',
        phone: '01712345678',
        divisionId: uuid,
        districtId: uuid2,
        line1: 'House 12, Road 4, Sector 3, Uttara',
        postalCode: '1230',
        isDefault: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBe('Home');
        expect(result.data.fullName).toBe('Raihan Uddin');
        expect(result.data.phone).toBe('01712345678');
        expect(result.data.isDefault).toBe(true);
      }
    });

    it('rejects input with missing required fields', () => {
      const result = saveAddressSchema.safeParse({
        fullName: 'Raihan',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown fields because of strict mode', () => {
      const result = saveAddressSchema.safeParse({
        fullName: 'Raihan Uddin',
        phone: '01712345678',
        divisionId: uuid,
        districtId: uuid2,
        line1: 'House 12, Road 4',
        isDefault: false,
        extraProperty: 'forbidden',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteAddressSchema and setDefaultAddressSchema', () => {
    it('validates valid address UUID', () => {
      expect(deleteAddressSchema.safeParse({ addressId: uuid }).success).toBe(true);
      expect(setDefaultAddressSchema.safeParse({ addressId: uuid }).success).toBe(true);
    });

    it('rejects non-uuid strings', () => {
      expect(deleteAddressSchema.safeParse({ addressId: 'invalid-id' }).success).toBe(false);
      expect(setDefaultAddressSchema.safeParse({ addressId: 'invalid-id' }).success).toBe(false);
    });
  });

  describe('updateProfileSchema', () => {
    it('accepts valid profile updates', () => {
      const result = updateProfileSchema.safeParse({
        name: 'Ahmed Khan',
        phone: '01812345678',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Ahmed Khan');
        expect(result.data.phone).toBe('01812345678');
      }
    });

    it('rejects names with less than 2 characters', () => {
      const result = updateProfileSchema.safeParse({
        name: 'A',
      });
      expect(result.success).toBe(false);
    });
  });
});
