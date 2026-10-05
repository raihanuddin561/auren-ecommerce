import { z } from 'zod';

const uuid = z.uuid();

/** Which area the customer picked. Ids only: names are looked up on the server. */
export const areaSelectionSchema = z
  .object({
    divisionId: uuid,
    districtId: uuid,
    thanaId: uuid.nullish(),
  })
  .strict();

export type AreaSelection = z.infer<typeof areaSelectionSchema>;

export const listAreasSchema = z.object({ parentId: uuid }).strict();

/** A decimal amount typed by an admin ("80", "1,299.50"); parsed through lib/money. */
const amountText = z.string().trim().min(1).max(20);

export const saveZoneSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(2).max(60),
    /** Divisions, districts or thanas this zone covers; ignored for the fallback zone. */
    geoAreaIds: z.array(uuid).max(200),
    isActive: z.boolean(),
  })
  .strict();

export const saveRateSchema = z
  .object({
    id: uuid.optional(),
    zoneId: uuid,
    name: z.string().trim().min(2).max(60),
    rate: amountText,
    /** Empty means delivery is never free. */
    freeOver: z.string().trim().max(20).optional(),
    minDays: z.number().int().min(0).max(60),
    maxDays: z.number().int().min(0).max(60),
    codAllowed: z.boolean(),
    isActive: z.boolean(),
  })
  .strict()
  .refine((value) => value.maxDays >= value.minDays, {
    path: ['maxDays'],
    message: 'The latest delivery day cannot be before the earliest.',
  });

export type SaveZoneInput = z.infer<typeof saveZoneSchema>;
export type SaveRateInput = z.infer<typeof saveRateSchema>;
