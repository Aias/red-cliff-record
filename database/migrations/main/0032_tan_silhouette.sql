DROP MATERIALIZED VIEW "arc"."browsing_history_daily";

--> statement-breakpoint
ALTER TABLE "github"."stars"
RENAME COLUMN "url" TO "repo_url";

--> statement-breakpoint
ALTER TABLE "github"."stars"
RENAME COLUMN "title" TO "name";

--> statement-breakpoint
ALTER TABLE "github"."stars"
RENAME COLUMN "creator" TO "owner_login";

--> statement-breakpoint
ALTER TABLE "github"."stars"
RENAME COLUMN "content" TO "description";

--> statement-breakpoint
ALTER TABLE "github"."stars"
RENAME COLUMN "bookmarked_at" TO "starred_at";

--> statement-breakpoint
ALTER TABLE "github"."stars"
RENAME COLUMN "tags" TO "topics";

--> statement-breakpoint
ALTER TABLE "github"."stars"
DROP CONSTRAINT "stars_url_bookmarkedAt_unique";

--> statement-breakpoint
DROP INDEX IF EXISTS "stars_url_index";

--> statement-breakpoint
DROP INDEX IF EXISTS "stars_created_at_index";

--> statement-breakpoint
ALTER TABLE "github"."stars"
ALTER COLUMN "id"
SET
	DATA TYPE integer;

--> statement-breakpoint
ALTER TABLE "github"."stars"
ADD COLUMN "homepage_url" text;

--> statement-breakpoint
ALTER TABLE "github"."stars"
ADD COLUMN "full_name" text;

--> statement-breakpoint
ALTER TABLE "github"."stars"
ADD COLUMN "license_name" text;

--> statement-breakpoint
ALTER TABLE "github"."stars"
ADD COLUMN "language" text;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stars_starred_at_index" ON "github"."stars" USING btree ("starred_at");

--> statement-breakpoint
ALTER TABLE "github"."stars"
DROP COLUMN IF EXISTS "notes";

--> statement-breakpoint
ALTER TABLE "github"."stars"
DROP COLUMN IF EXISTS "type";

--> statement-breakpoint
ALTER TABLE "github"."stars"
DROP COLUMN IF EXISTS "category";

--> statement-breakpoint
ALTER TABLE "github"."stars"
DROP COLUMN IF EXISTS "important";

--> statement-breakpoint
ALTER TABLE "github"."stars"
DROP COLUMN IF EXISTS "image_url";

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
		DATE ("browsing_history"."view_time"),
		"browsing_history"."url",
		"browsing_history"."page_title"
);