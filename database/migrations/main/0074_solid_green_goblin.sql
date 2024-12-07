DROP INDEX IF EXISTS "github_stars_starred_at_index";

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_stars_content_created_at_index" ON "integrations"."github_stars" USING btree ("content_created_at");

--> statement-breakpoint
ALTER TABLE "integrations"."github_stars"
DROP COLUMN IF EXISTS "starred_at";