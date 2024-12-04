ALTER TYPE "public"."media_type" RENAME TO "media_format";--> statement-breakpoint
ALTER TYPE "public"."url_type" RENAME TO "page_type";--> statement-breakpoint
ALTER TABLE "documents" RENAME TO "page_contents";--> statement-breakpoint
ALTER TABLE "url_links" RENAME TO "page_links";--> statement-breakpoint
ALTER TABLE "urls" RENAME TO "pages";--> statement-breakpoint
ALTER TABLE "page_contents" RENAME COLUMN "url_id" TO "page_id";--> statement-breakpoint
ALTER TABLE "page_contents" RENAME COLUMN "content" TO "content_html";--> statement-breakpoint
ALTER TABLE "index_entries" RENAME COLUMN "canonical_url_id" TO "canonical_page_id";--> statement-breakpoint
ALTER TABLE "locations" RENAME COLUMN "map_url_id" TO "map_page_id";--> statement-breakpoint
ALTER TABLE "media" RENAME COLUMN "type" TO "format";--> statement-breakpoint
ALTER TABLE "media" RENAME COLUMN "url_id" TO "source_page_id";--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "url_idx";--> statement-breakpoint
ALTER TABLE "page_contents" DROP CONSTRAINT "documents_url_id_urls_id_fk";
--> statement-breakpoint
ALTER TABLE "index_entries" DROP CONSTRAINT "index_entries_canonical_url_id_urls_id_fk";
--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_map_url_id_urls_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_url_id_urls_id_fk";
--> statement-breakpoint
ALTER TABLE "page_links" DROP CONSTRAINT "url_links_source_id_urls_id_fk";
--> statement-breakpoint
ALTER TABLE "page_links" DROP CONSTRAINT "url_links_target_id_urls_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "document_format_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "media_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "media_url_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "content_type_idx";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "url" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "page_contents" ADD COLUMN "content_markdown" text;--> statement-breakpoint
ALTER TABLE "page_contents" ADD COLUMN "crawl_date" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "map_image_id" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "mime_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "domain" text GENERATED ALWAYS AS (LOWER(regexp_replace("pages"."url", '^https?://([^/]+).*$', '\1'))) STORED;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "last_successful_crawl_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "metadata" json;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "page_contents" ADD CONSTRAINT "page_contents_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "index_entries" ADD CONSTRAINT "index_entries_canonical_page_id_pages_id_fk" FOREIGN KEY ("canonical_page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_map_page_id_page_links_id_fk" FOREIGN KEY ("map_page_id") REFERENCES "public"."page_links"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_map_image_id_media_id_fk" FOREIGN KEY ("map_image_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_source_page_id_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "page_links" ADD CONSTRAINT "page_links_source_id_pages_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "page_links" ADD CONSTRAINT "page_links_target_id_pages_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_content_idx" ON "page_contents" USING btree ("page_id","crawl_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_format_idx" ON "media" USING btree ("format");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_mime_type_idx" ON "media" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_source_idx" ON "media" USING btree ("source_page_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_links_source_idx" ON "page_links" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_links_target_idx" ON "page_links" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_domain_idx" ON "pages" USING btree ("domain");--> statement-breakpoint
ALTER TABLE "page_contents" DROP COLUMN IF EXISTS "title";--> statement-breakpoint
ALTER TABLE "page_contents" DROP COLUMN IF EXISTS "format";--> statement-breakpoint
ALTER TABLE "page_contents" DROP COLUMN IF EXISTS "metadata";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN IF EXISTS "content_type";--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_url_idx" UNIQUE("url");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "page_url_idx" UNIQUE("url");--> statement-breakpoint
ALTER TABLE "public"."media" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."media_format";--> statement-breakpoint
CREATE TYPE "public"."media_format" AS ENUM('image', 'video', 'audio', 'text', 'application', 'unknown');--> statement-breakpoint
ALTER TABLE "public"."media" ALTER COLUMN "format" SET DATA TYPE "public"."media_format" USING "format"::"public"."media_format";--> statement-breakpoint
DROP TYPE "public"."document_format";