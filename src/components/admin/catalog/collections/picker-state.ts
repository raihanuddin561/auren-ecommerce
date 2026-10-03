/** Pure selection logic of the "add products" picker. */

export const MAX_PRODUCTS_PER_ADD = 100;

export interface PickerProduct {
  id: string;
  title: string;
  status: string;
  imageUrl: string | null;
}

export const isSelected = (selected: readonly PickerProduct[], id: string): boolean =>
  selected.some((item) => item.id === id);

/**
 * Adds or removes one product. Selections survive new searches, so they are kept as whole items
 * (a product picked earlier may not be in the latest results). The list is capped at what one add
 * may carry; a product past the cap is ignored.
 */
export function toggleSelected(
  selected: readonly PickerProduct[],
  item: PickerProduct,
): PickerProduct[] {
  if (isSelected(selected, item.id)) return selected.filter((s) => s.id !== item.id);
  if (selected.length >= MAX_PRODUCTS_PER_ADD) return [...selected];
  return [...selected, item];
}

/** Drops chosen products that have since become members (after an add elsewhere). */
export function withoutMembers(
  selected: readonly PickerProduct[],
  memberIds: readonly string[],
): PickerProduct[] {
  const members = new Set(memberIds);
  return selected.filter((item) => !members.has(item.id));
}
