DO $$ BEGIN
ALTER TYPE "integrations"."integration_type" ADD VALUE 'crawler' BEFORE 'github';
ALTER TYPE "integrations"."integration_type" ADD VALUE 'manual' BEFORE 'raindrop';
EXCEPTION
 WHEN OTHERS THEN null;
END $$;
COMMIT;

ALTER TABLE "page_links" RENAME TO "source_links";--> statement-breakpoint
ALTER TABLE "pages" RENAME TO "sources";--> statement-breakpoint
ALTER TABLE "page_contents" RENAME COLUMN "page_id" TO "source_id";--> statement-breakpoint
ALTER TABLE "source_links" RENAME COLUMN "source_id" TO "from_source_id";--> statement-breakpoint
ALTER TABLE "source_links" RENAME COLUMN "target_id" TO "to_source_id";--> statement-breakpoint
ALTER TABLE "source_links" DROP CONSTRAINT "page_link_unique_idx";--> statement-breakpoint
ALTER TABLE "sources" DROP CONSTRAINT "page_url_idx";--> statement-breakpoint
ALTER TABLE "index_entries" DROP CONSTRAINT "index_entries_canonical_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_map_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_source_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "page_contents" DROP CONSTRAINT "page_contents_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "source_links" DROP CONSTRAINT "page_links_source_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "source_links" DROP CONSTRAINT "page_links_target_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "record_pages" DROP CONSTRAINT "record_pages_page_id_pages_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "page_content_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "page_links_source_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "page_links_target_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "page_domain_idx";--> statement-breakpoint
ALTER TABLE "sources" drop column "domain";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "domain" text GENERATED ALWAYS AS (LOWER(regexp_replace("sources"."url", '^https?://([^/]+).*$', '\1'))) STORED;--> statement-breakpoint
ALTER TABLE "page_contents" ADD COLUMN "metadata" json;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "origin" "integrations"."integration_type" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "should_crawl" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_canonical_page_id_sources_id_fk" FOREIGN KEY ("canonical_page_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_map_page_id_sources_id_fk" FOREIGN KEY ("map_page_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_source_page_id_sources_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "page_contents" ADD CONSTRAINT "page_contents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_links" ADD CONSTRAINT "source_links_from_source_id_sources_id_fk" FOREIGN KEY ("from_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_links" ADD CONSTRAINT "source_links_to_source_id_sources_id_fk" FOREIGN KEY ("to_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_pages" ADD CONSTRAINT "record_pages_page_id_sources_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_content_source_idx" ON "page_contents" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_links_source_idx" ON "source_links" USING btree ("from_source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_links_target_idx" ON "source_links" USING btree ("to_source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_domain_idx" ON "sources" USING btree ("domain");--> statement-breakpoint
ALTER TABLE "page_contents" DROP COLUMN IF EXISTS "crawl_date";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN IF EXISTS "metadata";--> statement-breakpoint
ALTER TABLE "source_links" ADD CONSTRAINT "source_link_unique_idx" UNIQUE("from_source_id","to_source_id");--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "source_url_idx" UNIQUE("url");--> statement-breakpoint
DROP TYPE "public"."page_type";