DROP INDEX IF EXISTS "stars_starred_at_index";

--> statement-breakpoint
ALTER TABLE "github"."stars"
DROP COLUMN IF EXISTS "starred_at";