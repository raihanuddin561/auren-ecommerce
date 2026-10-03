-- Retention for finished events.
--
-- The application role cannot delete outbox or inbox rows (ADR-021), so retention runs through one
-- narrow function owned by the schema owner. It removes only DISPATCHED outbox rows and consumer
-- claims older than the retention period (at least 7 days); `failed` rows are never deleted, and
-- a claim is kept while its outbox event is not finished, so a late replay cannot run a handler
-- twice. Work is done in batches so one call never runs into the application statement timeout.

-- Deleting an outbox row is allowed only from inside purge_finished_events(), and never for the
-- application role.
CREATE OR REPLACE FUNCTION "outbox_events_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'dispatched'
       AND current_setting('auren.event_purge', true) = 'on'
       AND current_user <> 'auren_app' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'outbox_events rows cannot be deleted';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."aggregate_type" IS DISTINCT FROM OLD."aggregate_type"
     OR NEW."aggregate_id" IS DISTINCT FROM OLD."aggregate_id"
     OR NEW."payload" IS DISTINCT FROM OLD."payload"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'outbox_events content is immutable';
  END IF;
  IF OLD."status" = 'dispatched'
     AND (NEW."status" IS DISTINCT FROM OLD."status"
          OR NEW."dispatched_at" IS DISTINCT FROM OLD."dispatched_at") THEN
    RAISE EXCEPTION 'a dispatched outbox event cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "purge_finished_events"("retain_days" integer)
RETURNS TABLE ("outbox_deleted" bigint, "inbox_deleted" bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  cutoff timestamptz;
  batch_size CONSTANT integer := 5000;
  max_batches CONSTANT integer := 20;
  n bigint;
  outbox_total bigint := 0;
  inbox_total bigint := 0;
BEGIN
  IF retain_days IS NULL OR retain_days < 7 THEN
    RAISE EXCEPTION 'retention must be at least 7 days';
  END IF;
  cutoff := pg_catalog.now() - pg_catalog.make_interval(days => retain_days);

  PERFORM pg_catalog.set_config('auren.event_purge', 'on', true);
  FOR i IN 1..max_batches LOOP
    DELETE FROM public.outbox_events
     WHERE id IN (SELECT id FROM public.outbox_events
                   WHERE status = 'dispatched' AND dispatched_at < cutoff
                   LIMIT batch_size);
    GET DIAGNOSTICS n = ROW_COUNT;
    outbox_total := outbox_total + n;
    EXIT WHEN n < batch_size;
  END LOOP;
  PERFORM pg_catalog.set_config('auren.event_purge', 'off', true);

  FOR i IN 1..max_batches LOOP
    DELETE FROM public.processed_events p
     WHERE (p.consumer, p.event_id) IN (
       SELECT c.consumer, c.event_id FROM public.processed_events c
        WHERE c.processed_at < cutoff
          AND NOT EXISTS (SELECT 1 FROM public.outbox_events o
                           WHERE o.id::text = c.event_id AND o.status <> 'dispatched')
        LIMIT batch_size);
    GET DIAGNOSTICS n = ROW_COUNT;
    inbox_total := inbox_total + n;
    EXIT WHEN n < batch_size;
  END LOOP;

  RETURN QUERY SELECT outbox_total, inbox_total;
END;
$$;

REVOKE ALL ON FUNCTION "purge_finished_events"(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "purge_finished_events"(integer) TO "auren_app";
