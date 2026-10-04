import { DomainError } from '@/lib/errors';
import * as inventory from '@/modules/inventory/service';
import type { AddToCartInput, AddToCartResult } from './schemas';

/**
 * Checks that a line could be added to the bag. Stock is read live from the inventory service (the
 * browser never decides availability). Nothing is stored yet: the cart arrives in the next stage.
 */
export async function addLine(input: AddToCartInput): Promise<AddToCartResult> {
  const availability = (await inventory.getAvailability([input.variantId])).get(input.variantId);
  // A variant the inventory has no stock for (or does not know) cannot be sold.
  if (!availability || availability.available < input.quantity) {
    throw new DomainError(
      'OUT_OF_STOCK',
      availability && availability.available > 0
        ? `Only ${availability.available} left in that size.`
        : 'That size is sold out.',
    );
  }

  // INTEGRATION POINT (cart stage): create or load the visitor's cart and upsert the line here,
  // inside one transaction with a stock reservation policy decided by the cart stage.
  return { variantId: input.variantId, quantity: input.quantity, persisted: false };
}
