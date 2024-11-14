ALTER TABLE "airtable"."airtable_attachments" RENAME TO "attachments";--> statement-breakpoint
ALTER TABLE "airtable"."airtable_creators" RENAME TO "creators";--> statement-breakpoint
ALTER TABLE "airtable"."airtable_extract_connections" RENAME TO "extract_connections";--> statement-breakpoint
ALTER TABLE "airtable"."airtable_extract_creators" RENAME TO "extract_creators";--> statement-breakpoint
ALTER TABLE "airtable"."airtable_extract_spaces" RENAME TO "extract_spaces";--> statement-breakpoint
ALTER TABLE "airtable"."airtable_extracts" RENAME TO "extracts";--> statement-breakpoint
ALTER TABLE "airtable"."airtable_spaces" RENAME TO "spaces";--> statement-breakpoint
ALTER TABLE "airtable"."attachments" DROP CONSTRAINT "airtable_attachments_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."creators" DROP CONSTRAINT "airtable_creators_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extract_connections" DROP CONSTRAINT "airtable_extract_connections_from_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extract_connections" DROP CONSTRAINT "airtable_extract_connections_to_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extract_creators" DROP CONSTRAINT "airtable_extract_creators_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extract_creators" DROP CONSTRAINT "airtable_extract_creators_creator_id_airtable_creators_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extract_spaces" DROP CONSTRAINT "airtable_extract_spaces_extract_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extract_spaces" DROP CONSTRAINT "airtable_extract_spaces_space_id_airtable_spaces_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extracts" DROP CONSTRAINT "airtable_extracts_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extracts" DROP CONSTRAINT "airtable_extracts_parent_id_airtable_extracts_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."spaces" DROP CONSTRAINT "airtable_spaces_integration_run_id_integration_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "airtable"."extract_connections" DROP CONSTRAINT "airtable_extract_connections_from_extract_id_to_extract_id_pk";--> statement-breakpoint
ALTER TABLE "airtable"."extract_creators" DROP CONSTRAINT "airtable_extract_creators_extract_id_creator_id_pk";--> statement-breakpoint
ALTER TABLE "airtable"."extract_spaces" DROP CONSTRAINT "airtable_extract_spaces_extract_id_space_id_pk";--> statement-breakpoint
ALTER TABLE "airtable"."extract_connections" ADD CONSTRAINT "extract_connections_from_extract_id_to_extract_id_pk" PRIMARY KEY("from_extract_id","to_extract_id");--> statement-breakpoint
ALTER TABLE "airtable"."extract_creators" ADD CONSTRAINT "extract_creators_extract_id_creator_id_pk" PRIMARY KEY("extract_id","creator_id");--> statement-breakpoint
ALTER TABLE "airtable"."extract_spaces" ADD CONSTRAINT "extract_spaces_extract_id_space_id_pk" PRIMARY KEY("extract_id","space_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."attachments" ADD CONSTRAINT "attachments_extract_id_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "airtable"."extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."creators" ADD CONSTRAINT "creators_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."extract_connections" ADD CONSTRAINT "extract_connections_from_extract_id_extracts_id_fk" FOREIGN KEY ("from_extract_id") REFERENCES "airtable"."extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."extract_connections" ADD CONSTRAINT "extract_connections_to_extract_id_extracts_id_fk" FOREIGN KEY ("to_extract_id") REFERENCES "airtable"."extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."extract_creators" ADD CONSTRAINT "extract_creators_extract_id_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "airtable"."extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."extract_creators" ADD CONSTRAINT "extract_creators_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "airtable"."creators"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."extract_spaces" ADD CONSTRAINT "extract_spaces_extract_id_extracts_id_fk" FOREIGN KEY ("extract_id") REFERENCES "airtable"."extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."extract_spaces" ADD CONSTRAINT "extract_spaces_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "airtable"."spaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."extracts" ADD CONSTRAINT "extracts_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."extracts" ADD CONSTRAINT "extracts_parent_id_extracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "airtable"."extracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable"."spaces" ADD CONSTRAINT "spaces_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
