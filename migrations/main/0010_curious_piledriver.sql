ALTER TABLE "public"."record_relations" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."record_relation_type";--> statement-breakpoint
CREATE TYPE "public"."record_relation_type" AS ENUM('part_of', 'primary_source', 'quotes', 'copied_from', 'derived_from', 'references', 'similar_to', 'responds_to', 'contradicts', 'supports');--> statement-breakpoint
ALTER TABLE "public"."record_relations" ALTER COLUMN "type" SET DATA TYPE "public"."record_relation_type" USING "type"::"public"."record_relation_type";