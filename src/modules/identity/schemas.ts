import { z } from 'zod';
import { PURPOSE_PATTERN } from '@/lib/step-up-token';

/** What the confirmation unlocks, for example `orders.refund` or `customers.export`. */
const purpose = z.string().max(60).regex(PURPOSE_PATTERN, 'Unknown action');

/** Re-enter the password, or the current authenticator code, to confirm a sensitive action. */
export const confirmStepUpSchema = z.discriminatedUnion('method', [
  z
    .object({ method: z.literal('password'), purpose, password: z.string().min(1).max(128) })
    .strict(),
  z
    .object({
      method: z.literal('totp'),
      purpose,
      code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    })
    .strict(),
]);

export type ConfirmStepUpInput = z.infer<typeof confirmStepUpSchema>;
