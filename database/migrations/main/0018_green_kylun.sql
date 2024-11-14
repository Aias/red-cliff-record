CREATE SCHEMA "integrations";
--> statement-breakpoint
ALTER TYPE "public"."integration_status" SET SCHEMA "integrations";--> statement-breakpoint
ALTER TYPE "public"."integration_type" SET SCHEMA "integrations";--> statement-breakpoint
ALTER TYPE "public"."run_type" SET SCHEMA "integrations";--> statement-breakpoint
ALTER TABLE "integration_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."integration_runs" SET SCHEMA "integrations";
--> statement-breakpoint
ALTER TABLE "airtable_creators" DROP CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable_extracts" DROP CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable_spaces" DROP CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "bookmarks" DROP CONSTRAINT "bookmarks_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "browsing_history" DROP CONSTRAINT "browsing_history_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "commits" DROP CONSTRAINT "commits_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_creators" ADD CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_extracts" ADD CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_spaces" ADD CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commits" ADD CONSTRAINT "commits_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
