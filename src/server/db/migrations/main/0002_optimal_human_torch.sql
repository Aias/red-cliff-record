DROP MATERIALIZED VIEW "integrations"."arc_browsing_history_daily";

--> statement-breakpoint
CREATE MATERIALIZED VIEW "integrations"."arc_browsing_history_daily" AS (
	select
		date_trunc ('day', "view_time") as "day_start",
		"url" as "url",
		"page_title" as "page_title",
		"hostname" as "hostname",
		SUM(COALESCE("view_duration", 0)) as "total_duration",
		MIN("view_time") as "first_visit",
		MAX("view_time") as "last_visit",
		COUNT(*) as "visit_count"
	from
		"integrations"."arc_browsing_history"
	group by
		date_trunc (
			'day',
			"integrations"."arc_browsing_history"."view_time"
		),
		"integrations"."arc_browsing_history"."url",
		"integrations"."arc_browsing_history"."page_title",
		"integrations"."arc_browsing_history"."hostname"
);