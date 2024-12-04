ALTER TABLE "media" DROP CONSTRAINT "media_source_id_pages_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "media_source_idx";--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source_page_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_source_page_id_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_source_idx" ON "media" USING btree ("source_page_id");--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN IF EXISTS "source_id";