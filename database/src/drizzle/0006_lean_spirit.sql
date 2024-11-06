CREATE TABLE IF NOT EXISTS "bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"notes" text,
	"type" text,
	"category" text,
	"tags" text[],
	"starred" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"integration_run_id" integer NOT NULL,
	"updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_integration_run_id_integration_runs_id_fk" FOREIGN KEY ("integration_run_id") REFERENCES "public"."integration_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarks_integration_run_id_index" ON "bookmarks" USING btree ("integration_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarks_url_index" ON "bookmarks" USING btree ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarks_starred_index" ON "bookmarks" USING btree ("starred");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarks_created_at_index" ON "bookmarks" USING btree ("created_at");