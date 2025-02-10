CREATE TYPE "public"."child_record_type" AS ENUM('part_of', 'primary_source', 'quotes', 'copied_from', 'derived_from');--> statement-breakpoint
ALTER TABLE "indices" DROP CONSTRAINT "indices_name_sense_main_type_unique";--> statement-breakpoint
ALTER TABLE "readwise_tags" ALTER COLUMN "tag" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "child_type" "child_record_type";--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "child_order" text DEFAULT 'a0' NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "transclude_id" integer;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_parent_id_records_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_transclude_id_records_id_fk" FOREIGN KEY ("transclude_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "record_categories" DROP COLUMN "primary";--> statement-breakpoint
ALTER TABLE "indices" ADD CONSTRAINT "indices_main_type_name_sense_unique" UNIQUE("main_type","name","sense");--> statement-breakpoint
ALTER TABLE "public"."record_relations" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."record_relation_type";--> statement-breakpoint
CREATE TYPE "public"."record_relation_type" AS ENUM('related_to', 'references', 'responds_to', 'contradicts', 'supports');--> statement-breakpoint
ALTER TABLE "public"."record_relations" ALTER COLUMN "type" SET DATA TYPE "public"."record_relation_type" USING "type"::"public"."record_relation_type";
ALTER TABLE "record_categories" ALTER COLUMN "type" SET DEFAULT 'file_under';--> statement-breakpoint
ALTER TABLE "record_creators" ALTER COLUMN "role" SET DEFAULT 'creator';--> statement-breakpoint
ALTER TABLE "record_relations" ALTER COLUMN "type" SET DEFAULT 'related_to';--> statement-breakpoint