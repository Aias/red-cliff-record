CREATE SCHEMA "readwise";
--> statement-breakpoint
CREATE TYPE "readwise"."category" AS ENUM('article', 'email', 'rss', 'highlight', 'note', 'pdf', 'epub', 'tweet', 'video');--> statement-breakpoint
CREATE TYPE "readwise"."location" AS ENUM('new', 'later', 'shortlist', 'archive', 'feed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "readwise"."documents" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"source_url" text,
	"title" text NOT NULL,
	"author" text,
	"source" text,
	"category" "readwise"."category",
	"location" "readwise"."location",
	"tags" text[],
	"site_name" text,
	"word_count" integer,
	"notes" text,
	"published_date" date,
	"summary" text,
	"image_url" text,
	"parent_id" text,
	"reading_progress" numeric,
	"first_opened_at" timestamp,
	"last_opened_at" timestamp,
	"saved_at" timestamp NOT NULL,
	"last_moved_at" timestamp NOT NULL,
	"integration_run_id" integer NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "readwise"."documents" ADD CONSTRAINT "documents_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "readwise"."documents" ADD CONSTRAINT "documents_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "readwise"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_integration_run_id_index" ON "readwise"."documents" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_url_index" ON "readwise"."documents" USING btree ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_created_at_index" ON "readwise"."documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_parent_id_index" ON "readwise"."documents" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "integrations"."integration_runs" ALTER COLUMN "integration_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "integrations"."integration_type";--> statement-breakpoint
CREATE TYPE "integrations"."integration_type" AS ENUM('ai_chat', 'airtable', 'browser_history', 'github', 'raindrop', 'readwise', 'twitter');--> statement-breakpoint
ALTER TABLE "integrations"."integration_runs" ALTER COLUMN "integration_type" SET DATA TYPE "integrations"."integration_type" USING "integration_type"::"integrations"."integration_type";