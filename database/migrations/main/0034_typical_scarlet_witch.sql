CREATE INDEX IF NOT EXISTS "browsing_history_view_epoch_microseconds_index" ON "arc"."browsing_history" USING btree ("view_epoch_microseconds");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "browsing_history_hostname_index" ON "arc"."browsing_history" USING btree ("hostname");