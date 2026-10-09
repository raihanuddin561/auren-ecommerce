-- Order cost lines are an append-only ledger, so a correction is a reversing line with a negative
-- amount of the same type (a changed courier charge, a refunded packaging cost). Only zero is refused.
ALTER TABLE "order_cost_lines" DROP CONSTRAINT "order_cost_lines_amount_check";
ALTER TABLE "order_cost_lines" ADD CONSTRAINT "order_cost_lines_amount_check"
  CHECK ("amount_minor" <> 0 AND "currency" ~ '^[A-Z]{3}$');
