DROP MATERIALIZED VIEW "public"."browsing_history_daily";

--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."browsing_history_daily" AS (
	select
		DATE ("view_time") as "date",
		"url",
		"page_title",
		SUM(COALESCE("view_duration", 0)) as "total_duration",
		MIN("view_time") as "first_visit",
		MAX("view_time") as "last_visit",
		COUNT(*) as "visit_count"
	from
		"browsing_history"
	group by
		DATE ("view_time"),
		"url",
		"page_title"
);