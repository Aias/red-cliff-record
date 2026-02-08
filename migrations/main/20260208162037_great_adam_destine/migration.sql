CREATE TABLE "raindrop_highlights" (
	"id" text PRIMARY KEY,
	"text" text NOT NULL,
	"note" text,
	"bookmark_id" integer NOT NULL,
	"record_id" integer,
	"deleted_at" timestamp with time zone,
	"content_created_at" timestamp with time zone,
	"content_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "raindrop_highlights_bookmark_id_index" ON "raindrop_highlights" ("bookmark_id");--> statement-breakpoint
CREATE INDEX "raindrop_highlights_record_id_index" ON "raindrop_highlights" ("record_id");--> statement-breakpoint
CREATE INDEX "raindrop_highlights_deleted_at_index" ON "raindrop_highlights" ("deleted_at");--> statement-breakpoint
ALTER TABLE "raindrop_highlights" ADD CONSTRAINT "raindrop_highlights_bookmark_id_raindrop_bookmarks_id_fkey" FOREIGN KEY ("bookmark_id") REFERENCES "raindrop_bookmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "raindrop_highlights" ADD CONSTRAINT "raindrop_highlights_record_id_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE SET NULL ON UPDATE CASCADE;