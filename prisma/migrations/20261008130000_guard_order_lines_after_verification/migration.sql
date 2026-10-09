-- Order lines and totals are editable only while a person is still verifying the order (6.14):
-- from `confirmed` on they are frozen, except that returns may raise `quantity_returned` and an
-- exchange may add a replacement line. This moves the old "never delete" rule into the database as
-- a state rule: a DELETE of a line is allowed only on an order that is still open.

CREATE FUNCTION "order_items_guard_edit"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  parent_status text;
  open_statuses constant text[] := ARRAY['pending_payment', 'placed', 'under_verification', 'on_hold'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT o."status"::text INTO parent_status FROM "orders" o WHERE o."id" = OLD."order_id";
    IF parent_status IS NOT NULL AND NOT (parent_status = ANY (open_statuses)) THEN
      RAISE EXCEPTION 'order lines cannot be removed once the order is confirmed' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  SELECT o."status"::text INTO parent_status FROM "orders" o WHERE o."id" = NEW."order_id";
  IF parent_status = ANY (open_statuses) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."replacement_of_item_id" IS NOT NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'order lines cannot be added once the order is confirmed' USING ERRCODE = '23514';
  END IF;
  -- UPDATE of a frozen order: only the returned quantity may change.
  IF (to_jsonb(NEW) - 'quantity_returned') IS DISTINCT FROM (to_jsonb(OLD) - 'quantity_returned') THEN
    RAISE EXCEPTION 'order lines cannot be changed once the order is confirmed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "order_items_guard_edit_trg"
  BEFORE INSERT OR UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION "order_items_guard_edit"();

CREATE FUNCTION "orders_guard_totals"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD."status"::text NOT IN ('pending_payment', 'placed', 'under_verification', 'on_hold')
     AND (NEW."subtotal_minor", NEW."discount_minor", NEW."shipping_charged_minor", NEW."total_minor", NEW."currency")
         IS DISTINCT FROM
         (OLD."subtotal_minor", OLD."discount_minor", OLD."shipping_charged_minor", OLD."total_minor", OLD."currency") THEN
    RAISE EXCEPTION 'order totals cannot change once the order is confirmed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "orders_guard_totals_trg"
  BEFORE UPDATE ON "orders" FOR EACH ROW EXECUTE FUNCTION "orders_guard_totals"();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auren_app') THEN
    -- Allowed again, but the trigger above refuses it on any order that is already confirmed.
    GRANT DELETE ON TABLE "order_items" TO "auren_app";
  END IF;
END
$$;
