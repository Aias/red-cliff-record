CREATE TYPE "public"."child_type" AS ENUM('part_of', 'quotes');--> statement-breakpoint
ALTER TABLE "readwise_documents" DROP CONSTRAINT "readwise_documents_media_id_media_id_fk";
--> statement-breakpoint
DROP INDEX "readwise_documents_media_id_index";--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "child_type" "child_type";--> statement-breakpoint
ALTER TABLE "readwise_documents" DROP COLUMN "media_id";

UPDATE "records" SET "child_type" = 'part_of' WHERE parent_id IS NOT NULL;