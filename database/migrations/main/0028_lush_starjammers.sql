CREATE SCHEMA "arc";

--> statement-breakpoint
ALTER TYPE "public"."browser"
SET SCHEMA "arc";

--> statement-breakpoint
ALTER TABLE "public"."browsing_history"
SET SCHEMA "arc";

DROP MATERIALIZED VIEW "public"."browsing_history_daily";

--> statement-breakpoint
CREATE MATERIALIZED VIEW "arc"."browsing_history_daily" AS (
	select
		DATE ("view_time") as "date",
		"url",
		"page_title",
		SUM(COALESCE("view_duration", 0)) as "total_duration",
		MIN("view_time") as "first_visit",
		MAX("view_time") as "last_visit",
		COUNT(*) as "visit_count"
	from
		"arc"."browsing_history"
	group by
		DATE ("arc"."browsing_history"."view_time"),
		"arc"."browsing_history"."url",
		"arc"."browsing_history"."page_title"
);