ALTER TYPE "public"."integration_type" ADD VALUE 'github';

--> statement-breakpoint
ALTER TABLE "integration_runs"
ADD COLUMN "integration_type" "integration_type";

--> statement-breakpoint
UPDATE "integration_runs" ir
SET
	"integration_type" = i."type"
FROM
	"integrations" i
WHERE
	ir."integration_id" = i."id";

--> statement-breakpoint
ALTER TABLE "integration_runs"
ALTER COLUMN "integration_type"
SET
	NOT NULL;

--> statement-breakpoint
ALTER TABLE "integrations" DISABLE ROW LEVEL SECURITY;

--> statement-breakpoint
DROP TABLE "integrations" CASCADE;

--> statement-breakpoint
ALTER TABLE "integration_runs"
DROP CONSTRAINT IF EXISTS "integration_runs_integration_id_integrations_id_fk";

--> statement-breakpoint
DROP INDEX IF EXISTS "integration_runs_integration_id_index";

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_runs_integration_type_index" ON "integration_runs" USING btree ("integration_type");

--> statement-breakpoint
ALTER TABLE "integration_runs"
DROP COLUMN IF EXISTS "integration_id";

--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."browsing_history_daily" AS (
	select
		"url",
		"page_title",
		DATE ("view_time") as "date",
		SUM(COALESCE("view_duration", 0)) as "total_duration",
		MIN("view_time") as "first_visit",
		MAX("view_time") as "last_visit",
		COUNT(*) as "visit_count"
	from
		"browsing_history"
	group by
		"url",
		"page_title",
		DATE ("view_time")
);