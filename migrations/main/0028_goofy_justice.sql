ALTER TYPE "public"."record_relation_type" ADD VALUE 'tagged' BEFORE 'related_to';--> statement-breakpoint
ALTER TYPE "public"."record_relation_type" ADD VALUE 'about' BEFORE 'references';--> statement-breakpoint
ALTER TYPE "public"."record_relation_type" ADD VALUE 'example_of' BEFORE 'references';--> statement-breakpoint
ALTER TABLE "record_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "record_categories" CASCADE;--> statement-breakpoint
ALTER TABLE "record_relations" ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "format_id" integer;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "is_format" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_format_id_records_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."records"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "records_format_id_index" ON "records" USING btree ("format_id");--> statement-breakpoint
CREATE INDEX "records_is_format_index" ON "records" USING btree ("is_format");--> statement-breakpoint
DROP TYPE "public"."categorization_type";