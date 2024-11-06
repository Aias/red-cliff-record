DELETE FROM "browsing_history";

ALTER TABLE "browsing_history"
RENAME COLUMN "total_visit_duration_seconds" TO "view_duration";

--> statement-breakpoint
ALTER TABLE "browsing_history"
ADD COLUMN "view_time" timestamp NOT NULL;

--> statement-breakpoint
ALTER TABLE "browsing_history"
ADD COLUMN "duration_since_last_view" integer;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "browsing_history_view_time_index" ON "browsing_history" USING btree ("view_time");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "browsing_history_url_index" ON "browsing_history" USING hash (url);

--> statement-breakpoint
ALTER TABLE "browsing_history"
DROP COLUMN IF EXISTS "date";

--> statement-breakpoint
ALTER TABLE "browsing_history"
DROP COLUMN IF EXISTS "visit_count";

--> statement-breakpoint
ALTER TABLE "browsing_history"
DROP COLUMN IF EXISTS "response_codes";

--> statement-breakpoint
ALTER TABLE "browsing_history"
DROP COLUMN IF EXISTS "first_visit_time";

--> statement-breakpoint
ALTER TABLE "browsing_history"
DROP COLUMN IF EXISTS "last_visit_time";