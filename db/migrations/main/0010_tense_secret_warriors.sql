DROP MATERIALIZED VIEW "integrations"."arc_browsing_history_daily";

--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history"
ALTER COLUMN "hostname"
SET
	NOT NULL;