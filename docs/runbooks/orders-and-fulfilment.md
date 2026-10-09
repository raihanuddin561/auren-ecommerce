# Orders, fulfilment, returns and order profit

How an order moves through AUREN, who does what, and where the money shows up. Decisions behind it: ADR-015, ADR-036 to ADR-041. Cost basis: `docs/runbooks/how-cost-works.md`.

## The rule that never changes

Every order is verified and confirmed by a person with `orders.verify` (owner, admin, manager, support, order verifier). Nothing is confirmed by a timer, a job, a webhook or a bulk button, and nothing is ever cancelled by the system. An order that nobody picks up stays in the queue, marked overdue, and managers are told.

## The journey (what to click)

1. **Stock in.** Admin > Purchasing > New purchase order > receive the goods. The receipt sets the stock and the cost of each variant (the cost is what profit is computed from).
2. **Customer orders.** On the storefront the customer chooses cash on delivery. The order is `Placed`; stock is held for them. Orders typed in by staff (phone, Facebook, Instagram, WhatsApp, in store) go through Admin > Orders > Enter an order and join the same queue.
3. **Verify.** Admin > Verification queue. Pick an order (J and K move through the list), claim it, call the customer (Call, SMS and WhatsApp buttons carry a ready message), then tick all five checklist points and press Confirm (key C). Other outcomes: Call back later (H) logs the attempt and puts the order on hold with a time; Cancel (X) needs a reason, puts the stock back and flags a fake order's phone; Edit order changes sizes, quantities, lines or the address and re-prices on the server. A manual order cannot be confirmed by the person who typed it, unless the owner switches that on in Settings > Orders and fulfilment.
4. **Ship.** Admin > Orders > the order > Book parcel. Choose Manual and type the courier or rider name, the tracking number and the courier charge, or choose Pathao or Steadfast when their keys are set. The order becomes `Shipped`; the customer is emailed and sent an SMS. Packaging (Settings > Orders and fulfilment) is added to the order costs.
5. **Deliver.** Update parcel status > Delivered (and, optionally, the courier collection fee). The cash on delivery payment is recorded as collected and the sale counts. A failed delivery lets you book again or record the parcel as back with us (restock, loss, phone note).
6. **Profit.** The order page shows Cost and profit (for staff who may see cost): gross sales, discounts, refunds, cost of goods, delivery charged, courier charge, fees, packaging, returns, and the contribution margin. Until delivery the figures are marked as projected.
7. **Returns.** The customer asks from their order page within the return window (7 days by default). Admin > Returns, or the order page: Approve, Mark received, Inspect (resellable goods go back on the shelf, damaged goods are written off), then Settle: refund, store credit or an exchange for another size. Refunds need `orders.refund`, a fresh password, and a second person's approval at or above BDT 5,000 (Admin > Approvals).

## Reminders and alerts

- Overdue orders are highlighted in the queue and managers are emailed once. The same happens after the configured number of failed contact attempts (default 3), marked "Needs a manager".
- Working hours, the target time, the attempt threshold and the claim time are in Settings > Orders and fulfilment. Only working hours count towards the target.

## What is not built yet

- Pathao and Steadfast are written from the public API documentation and tested against a fake; they have not been run against a live merchant account. Until you have accounts, use the manual courier.
- Courier webhooks (status is polled every 15 minutes for API couriers; the manual courier is updated by staff).
- SMS goes to the server log until a gateway is chosen; email goes through Resend when configured.
- Staff cannot yet open a return on a customer's behalf; the customer asks from their order page.
- Cash on delivery remittance reconciliation, online payments (SSLCommerz, Stripe) and failed-payment recovery.

## For developers

- One write path for order status: `src/modules/orders/transitions.ts`. Only `verification.ts` passes `confirmed` or `cancelled`; `tests/unit/order-status-writes.test.ts` fails if anything else does.
- Order lines and totals are frozen by database triggers once an order leaves verification; the confirmation guard (INV-O9) is in the order migration.
- Costs are append-only lines with their source (`order_cost_lines`); a correction adds a line. Formulas: `src/modules/finance/profit.ts` (ARCHITECTURE 7.2).
- Jobs (Inngest): order escalation scan (every 10 minutes), courier polling (every 15 minutes), completion after the return window (daily), and the message handlers for each outbox event.
