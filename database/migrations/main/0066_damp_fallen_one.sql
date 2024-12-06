ALTER TABLE "record_pages" RENAME TO "record_sources";--> statement-breakpoint
ALTER TABLE "source_links" RENAME TO "source_connections";--> statement-breakpoint
ALTER TABLE "page_contents" RENAME TO "source_contents";--> statement-breakpoint
ALTER TABLE "record_sources" RENAME COLUMN "page_id" TO "source_id";--> statement-breakpoint
ALTER TABLE "record_sources" DROP CONSTRAINT "record_page_unique_idx";--> statement-breakpoint
ALTER TABLE "source_connections" DROP CONSTRAINT "source_link_unique_idx";--> statement-breakpoint
ALTER TABLE "source_contents" DROP CONSTRAINT "page_contents_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "record_sources" DROP CONSTRAINT "record_pages_record_id_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_sources" DROP CONSTRAINT "record_pages_page_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "source_connections" DROP CONSTRAINT "source_links_from_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "source_connections" DROP CONSTRAINT "source_links_to_source_id_sources_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "page_content_source_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "record_page_record_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "record_page_page_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "source_links_source_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "source_links_target_idx";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_contents" ADD CONSTRAINT "source_contents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "record_sources" ADD CONSTRAINT "record_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_from_source_id_sources_id_fk" FOREIGN KEY ("from_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_to_source_id_sources_id_fk" FOREIGN KEY ("to_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_content_source_idx" ON "source_contents" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_source_record_idx" ON "record_sources" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_source_source_idx" ON "record_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_connection_source_idx" ON "source_connections" USING btree ("from_source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_connection_target_idx" ON "source_connections" USING btree ("to_source_id");--> statement-breakpoint
ALTER TABLE "record_sources" ADD CONSTRAINT "record_source_unique_idx" UNIQUE("record_id","source_id");--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connection_unique_idx" UNIQUE("from_source_id","to_source_id");