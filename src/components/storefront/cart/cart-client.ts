'use client';

import { toast } from '@/components/ui/toast';
import { addToCart, setCartLine, type CartActionData } from '@/modules/cart/actions';
import type { CartLineView } from '@/modules/cart/view';
import type { ActionResult } from '@/lib/action-result';
import { saveProductForLater } from '../catalog/wishlist-button';
import { openCartDrawer, setCartView } from './cart-store';

/** Browser-side helpers around the bag actions. The server answers every call with the whole bag. */

const SOMETHING_WENT_WRONG = 'We could not do that just now. Please try again.';

function failureText(result: Extract<ActionResult<CartActionData>, { ok: false }>): string {
  const { code, message } = result.error;
  if (code === 'RATE_LIMITED') return 'Please wait a moment and try again.';
  if ((code === 'OUT_OF_STOCK' || code === 'CONFLICT' || code === 'NOT_FOUND') && message) {
    return message;
  }
  return SOMETHING_WENT_WRONG;
}

async function call(
  work: () => Promise<ActionResult<CartActionData>>,
): Promise<ActionResult<CartActionData> | null> {
  try {
    return await work();
  } catch {
    toast.error(SOMETHING_WENT_WRONG);
    return null;
  }
}

/** Adds to the bag and opens the drawer. Returns true when the item is in the bag. */
export async function addToBag(variantId: string, quantity: number): Promise<boolean> {
  const result = await call(() => addToCart({ variantId, quantity }));
  if (!result) return false;
  if (!result.ok) {
    toast.error(failureText(result));
    return false;
  }
  setCartView(result.data.view);
  openCartDrawer();
  return true;
}

/** Sets a line to an exact quantity (the stepper). */
export async function changeQuantity(variantId: string, quantity: number): Promise<boolean> {
  const result = await call(() => setCartLine({ variantId, quantity }));
  if (!result) return false;
  if (!result.ok) {
    toast.error(failureText(result));
    return false;
  }
  setCartView(result.data.view);
  return true;
}

/** Removes a line and offers to undo it for a few seconds. */
export async function removeLine(line: CartLineView): Promise<void> {
  const removed = await changeQuantity(line.variantId, 0);
  if (!removed) return;
  toast.undoable(
    'Removed from your bag',
    () => {
      void changeQuantity(
        line.variantId,
        Math.max(1, Math.min(line.quantity, line.maxQuantity || 1)),
      );
    },
    `${line.productTitle}, ${line.optionsLabel}.`,
  );
}

/** Moves a line to the wishlist (kept in this browser until accounts arrive) and out of the bag. */
export async function saveLineForLater(line: CartLineView): Promise<void> {
  saveProductForLater(line.productId);
  const removed = await changeQuantity(line.variantId, 0);
  if (removed) {
    toast.message('Saved for later', `${line.productTitle} is in your wishlist on this device.`);
  }
}
