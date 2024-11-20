DROP MATERIALIZED VIEW "arc"."browsing_history_daily";

--> statement-breakpoint
ALTER TABLE "arc"."browsing_history"
ALTER COLUMN "view_time"
SET
	DATA TYPE timestamp
with
	time zone;

--> statement-breakpoint
CREATE MATERIALIZED VIEW "arc"."browsing_history_daily" AS (
	select
		DATE (
			"view_time" AT TIME ZONE CURRENT_SETTING ('timezone')
		) as "date",
		"url",
		"page_title",
		SUM(COALESCE("view_duration", 0)) as "total_duration",
		MIN("view_time") as "first_visit",
		MAX("view_time") as "last_visit",
		COUNT(*) as "visit_count"
	from
		"arc"."browsing_history"
	group by
		DATE (
			"arc"."browsing_history"."view_time" AT TIME ZONE CURRENT_SETTING ('timezone')
		),
		"arc"."browsing_history"."url",
		"arc"."browsing_history"."page_title"
);