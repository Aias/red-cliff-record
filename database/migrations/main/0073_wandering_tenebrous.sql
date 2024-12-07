DROP INDEX IF EXISTS "arc_browsing_history_url_idx";

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arc_browsing_history_url_idx" ON "integrations"."arc_browsing_history" USING btree ("url");