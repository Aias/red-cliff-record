CREATE SCHEMA "operations";
--> statement-breakpoint
ALTER TYPE "integrations"."integration_status" SET SCHEMA "operations";--> statement-breakpoint
ALTER TYPE "integrations"."integration_type" SET SCHEMA "operations";--> statement-breakpoint
ALTER TYPE "integrations"."run_type" SET SCHEMA "operations";--> statement-breakpoint
ALTER TABLE "integrations"."integration_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integrations"."integration_runs" SET SCHEMA "operations";
--> statement-breakpoint
ALTER TABLE "integrations"."adobe_lightroom_images" DROP CONSTRAINT "adobe_lightroom_images_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_creators" DROP CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_extracts" DROP CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."airtable_spaces" DROP CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."arc_browsing_history" DROP CONSTRAINT "arc_browsing_history_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_commits" DROP CONSTRAINT "github_commits_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."github_stars" DROP CONSTRAINT "github_stars_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_collections" DROP CONSTRAINT "raindrop_collections_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."raindrop_raindrops" DROP CONSTRAINT "raindrop_raindrops_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."readwise_documents" DROP CONSTRAINT "readwise_documents_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "integrations"."twitter_tweets" DROP CONSTRAINT "twitter_tweets_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "needs_curation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."adobe_lightroom_images" ADD CONSTRAINT "adobe_lightroom_images_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_creators" ADD CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_extracts" ADD CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."airtable_spaces" ADD CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."arc_browsing_history" ADD CONSTRAINT "arc_browsing_history_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_commits" ADD CONSTRAINT "github_commits_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."github_stars" ADD CONSTRAINT "github_stars_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."raindrop_collections" ADD CONSTRAINT "raindrop_collections_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."raindrop_raindrops" ADD CONSTRAINT "raindrop_raindrops_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."readwise_documents" ADD CONSTRAINT "readwise_documents_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integrations"."twitter_tweets" ADD CONSTRAINT "twitter_tweets_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "operations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
