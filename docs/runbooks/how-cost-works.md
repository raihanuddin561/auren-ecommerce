# How cost works

Plain language for the shop owner. Selling price and cost are two separate numbers.

## Two numbers per variant

- **Selling price** is what the customer pays. You set it on the product page (Options and variants).
- **Cost** is what one unit cost you, including freight, duty and similar charges. It is never typed on the product page. It is kept as a **weighted average cost** per variant.

Every order stores both numbers at the moment it is placed, so profit can always be worked out later and never changes when you edit prices or costs afterwards.

## A variant with no cost cannot be ordered

If a variant has stock but no cost, customers who try to order it see "cannot be ordered online right now. Please message our concierge", and the shop records a line in the audit trail (action `checkout.no_cost_refused`, at most once an hour per variant) so you can see what lost a sale. Inventory shows a banner: "N variants cannot be sold: no cost".

This is deliberate: without a cost, profit for that sale could not be recorded.

## Where cost comes from

1. **Purchase receipts.** Receiving goods on a purchase order sets or updates the cost (supplier price plus the share of landed costs). This is the normal route.
2. **Opening cost when adding stock.** In Inventory, Adjust stock, when you add units (reason Opening stock, Found stock, or a count that goes up) a field "Unit cost (BDT)" appears. It is required when the variant has no cost yet and optional afterwards. The average is updated with the same formula and rounding as a goods receipt:

   `new average = (units on hand x old average + units added x unit cost) / (units on hand + units added)`

   If the variant has stock but no cost at all, the typed cost becomes the cost of every unit (the unknown old units are not averaged in as "free").
3. **Set cost.** For variants that already hold stock but have no cost (for example products created in the admin and stocked before this feature), Inventory shows a "Set cost" button on each row marked "No cost". It fills a cost **only where there is none**. The same dialog can set the same cost for every variant of a product in one go, with a preview of which variants are changed and which keep their cost. It needs the inventory adjust permission and your password again.

Removing stock never changes cost. An existing cost is never overwritten by "Set cost": it changes only through purchase receipts and stock additions, so the history stays correct.

## What the owner does today (fixing existing variants)

1. Sign in, open **Inventory**.
2. Click **Show variants without cost** in the banner (or choose the filter "No cost: cannot be ordered").
3. On a row marked **No cost**, click **Set cost**.
4. Enter what one unit cost you in BDT, for example `1250`.
5. To use the same cost for every size, choose **All variants of this product**, check the preview, then **Set cost**.
6. Enter your password when asked. The row loses its "No cost" mark and the product can be ordered.

For new stock of a product without cost, use **Adjust** and fill in **Unit cost (BDT)** at the same time.

## What staff see

- Cost values are shown to staff who buy stock, read finance or adjust inventory. Other roles only see whether a cost exists.
- The product edit page shows On hand, Available (on hand minus reserved) and Cost per variant, a "No cost: cannot be ordered" chip, and links to Inventory. Publishing a product whose variants lack cost shows a warning but is not blocked.
