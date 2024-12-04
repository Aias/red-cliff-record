ALTER TABLE "locations" DROP CONSTRAINT "locations_map_page_id_page_links_id_fk";
--> statement-breakpoint
ALTER TABLE "index_entries" ADD COLUMN "canonical_media_id" integer;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "source_platform" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_canonical_media_id_media_id_fk" FOREIGN KEY ("canonical_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_map_page_id_pages_id_fk" FOREIGN KEY ("map_page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "canonical_page_idx" ON "index_entries" USING btree ("canonical_page_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "canonical_media_idx" ON "index_entries" USING btree ("canonical_media_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_map_page_idx" ON "locations" USING btree ("map_page_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_map_image_idx" ON "locations" USING btree ("map_image_id");--> statement-breakpoint
ALTER TABLE "index_relations" ADD CONSTRAINT "index_relation_unique_idx" UNIQUE("source_id","target_id","type");--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_link_unique_idx" UNIQUE("source_id","target_id");