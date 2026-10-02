-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('pending', 'dispatched', 'failed');

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "consumer" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("consumer","event_id")
);


-- Dispatcher scans only unfinished work.
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" ("created_at", "id") WHERE "status" = 'pending';

ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_attempts_check" CHECK ("attempts" >= 0);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_dispatched_check" CHECK ("status" <> 'dispatched' OR "dispatched_at" IS NOT NULL);

-- Shared guard for append-only ledgers (outbox, audit, and later stock and credit ledgers).
CREATE FUNCTION "forbid_ledger_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only (% blocked)', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- Append-only ledger: the event itself is immutable and can never be deleted. Only delivery
-- bookkeeping columns (status, attempts, available_at, locked_until, last_error, dispatched_at) change.
CREATE FUNCTION "outbox_events_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "outbox_events_guard_trg"
  BEFORE UPDATE OR DELETE ON "outbox_events"
  FOR EACH ROW EXECUTE FUNCTION "outbox_events_guard"();

CREATE TRIGGER "outbox_events_no_truncate_trg"
  BEFORE TRUNCATE ON "outbox_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_ledger_mutation"();
