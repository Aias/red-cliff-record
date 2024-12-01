CREATE TABLE
	IF NOT EXISTS "arc"."browsing_history_omit_list" (
		"pattern" text PRIMARY KEY NOT NULL,
		"updated_at" timestamp
		with
			time zone,
			"created_at" timestamp
		with
			time zone DEFAULT now () NOT NULL
	);

--> statement-breakpoint
DROP MATERIALIZED VIEW "arc"."browsing_history_daily";

--> statement-breakpoint
CREATE MATERIALIZED VIEW "arc"."browsing_history_daily" AS (
	select
		DATE (
			"view_time" AT TIME ZONE CURRENT_SETTING ('timezone')
		) as "date",
		"url" as "url",
		"page_title" as "page_title",
		"hostname" as "hostname",
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
		"arc"."browsing_history"."page_title",
		"arc"."browsing_history"."hostname"
);