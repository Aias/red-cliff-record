ALTER TYPE "arc"."browser"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TYPE "github"."commit_change_status"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TYPE "readwise"."category"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TYPE "readwise"."location"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER MATERIALIZED VIEW "arc"."browsing_history_daily"
SET SCHEMA "integrations";

--> statement-breakpoint
DROP MATERIALIZED VIEW "integrations"."browsing_history_daily";

--> statement-breakpoint
ALTER TABLE "adobe"."photographs"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "airtable"."attachments"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "airtable"."creators"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "airtable"."extract_connections"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "airtable"."extract_creators"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "airtable"."extract_spaces"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "airtable"."extracts"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "airtable"."spaces"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "arc"."browsing_history"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "arc"."browsing_history_omit_list"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "github"."commit_changes"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "github"."commits"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "github"."stars"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "raindrop"."collections"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "raindrop"."raindrops"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "readwise"."documents"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "twitter"."tweets"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "twitter"."twitter_media"
SET SCHEMA "integrations";

--> statement-breakpoint
ALTER TABLE "twitter"."twitter_users"
SET SCHEMA "integrations";

--> statement-breakpoint
CREATE MATERIALIZED VIEW "integrations"."browsing_history_daily" AS (
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
		"integrations"."browsing_history"
	group by
		DATE (
			"integrations"."browsing_history"."view_time" AT TIME ZONE CURRENT_SETTING ('timezone')
		),
		"integrations"."browsing_history"."url",
		"integrations"."browsing_history"."page_title",
		"integrations"."browsing_history"."hostname"
);

--> statement-breakpoint
DROP SCHEMA "adobe";

--> statement-breakpoint
DROP SCHEMA "airtable";

--> statement-breakpoint
DROP SCHEMA "arc";

--> statement-breakpoint
DROP SCHEMA "github";

--> statement-breakpoint
DROP SCHEMA "raindrop";

--> statement-breakpoint
DROP SCHEMA "readwise";

--> statement-breakpoint
DROP SCHEMA "twitter";