DROP INDEX "records_type_index";--> statement-breakpoint
ALTER TABLE "airtable_extracts" ALTER COLUMN "michelin_stars" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "airtable_extracts" ALTER COLUMN "michelin_stars" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "media_caption" text;--> statement-breakpoint
CREATE INDEX "records_title_index" ON "records" USING btree ("title");--> statement-breakpoint
CREATE INDEX "records_url_index" ON "records" USING btree ("url");--> statement-breakpoint
ALTER TABLE "airtable_creators" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "airtable_spaces" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "public"."record_relations" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."record_relation_type";--> statement-breakpoint
CREATE TYPE "public"."record_relation_type" AS ENUM('part_of', 'primary_source', 'quoted_from', 'copied_from', 'derived_from', 'references', 'similar_to', 'responds_to', 'contradicts', 'supports');--> statement-breakpoint
ALTER TABLE "public"."record_relations" ALTER COLUMN "type" SET DATA TYPE "public"."record_relation_type" USING "type"::"public"."record_relation_type";--> statement-breakpoint
DROP TYPE "public"."record_type";