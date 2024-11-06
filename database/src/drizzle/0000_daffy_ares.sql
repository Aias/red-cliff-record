CREATE TYPE "public"."integration_status" AS ENUM('success', 'fail');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('browser_history', 'airtable', 'ai_chat', 'raindrop');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "browsing_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"url" text NOT NULL,
	"page_title" text,
	"visit_count" integer DEFAULT 1,
	"total_visit_duration_seconds" integer,
	"search_terms" text,
	"related_searches" text,
	"response_codes" text,
	"first_visit_time" timestamp,
	"last_visit_time" timestamp,
	"integration_run_id" integer NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"status" "integration_status" NOT NULL,
	"message" text,
	"run_duration" real,
	"run_start_time" timestamp NOT NULL,
	"entries_created" integer DEFAULT 0,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "integration_type" NOT NULL,
	"description" text,
	"last_processed" timestamp,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_runs" ADD CONSTRAINT "integration_runs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "browsing_history_integration_run_id_index" ON "browsing_history" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_runs_integration_id_index" ON "integration_runs" USING btree ("integration_id");