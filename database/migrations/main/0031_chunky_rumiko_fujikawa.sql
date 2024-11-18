ALTER TABLE "public"."bookmarks" SET SCHEMA "github";
--> statement-breakpoint
ALTER TABLE "github"."bookmarks" RENAME TO "stars";--> statement-breakpoint
ALTER TABLE "github"."stars" DROP CONSTRAINT "bookmarks_url_bookmarkedAt_unique";--> statement-breakpoint
ALTER TABLE "github"."stars" DROP CONSTRAINT "bookmarks_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "bookmarks_integration_run_id_index";--> statement-breakpoint
DROP INDEX IF EXISTS "bookmarks_url_index";--> statement-breakpoint
DROP INDEX IF EXISTS "bookmarks_created_at_index";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github"."stars" ADD CONSTRAINT "stars_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stars_integration_run_id_index" ON "github"."stars" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stars_url_index" ON "github"."stars" USING btree ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stars_created_at_index" ON "github"."stars" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "github"."stars" ADD CONSTRAINT "stars_url_bookmarkedAt_unique" UNIQUE("url","bookmarked_at");