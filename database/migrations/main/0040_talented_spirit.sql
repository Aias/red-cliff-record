CREATE SCHEMA "adobe";
--> statement-breakpoint
ALTER TYPE "integrations"."integration_type" ADD VALUE 'lightroom' BEFORE 'raindrop';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "adobe"."photographs" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"device" text,
	"capture_date" timestamp with time zone NOT NULL,
	"user_updated_date" timestamp with time zone NOT NULL,
	"file_size" integer NOT NULL,
	"cropped_width" integer NOT NULL,
	"cropped_height" integer NOT NULL,
	"aesthetics" json,
	"auto_tags" text[],
	"integration_run_id" integer NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "adobe"."photographs" ADD CONSTRAINT "photographs_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "integrations"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photographs_integration_run_id_index" ON "adobe"."photographs" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photographs_capture_date_index" ON "adobe"."photographs" USING btree ("capture_date");