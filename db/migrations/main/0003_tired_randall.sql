ALTER TABLE "public"."index_entries" ALTER COLUMN "main_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."index_main_type";--> statement-breakpoint
CREATE TYPE "public"."index_main_type" AS ENUM('entity', 'category', 'format');--> statement-breakpoint
ALTER TABLE "public"."index_entries" ALTER COLUMN "main_type" SET DATA TYPE "public"."index_main_type" USING "main_type"::"public"."index_main_type";